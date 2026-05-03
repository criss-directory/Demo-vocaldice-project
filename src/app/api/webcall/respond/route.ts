import { NextResponse } from 'next/server';

const VOICE_RULE = '\n\nCRITICAL RULES FOR VOICE CALL:\n1. You are on a LIVE PHONE CALL. Keep responses to 1-2 complete, short sentences. Always finish your sentence — never cut off mid-thought.\n2. Be warm, professional, and natural — like a real medical receptionist.\n3. Respond in the SAME language the user is speaking. Use native script naturally (Telugu script, Devanagari, etc.). The TTS engine supports native scripts fully.\n4. Do not repeat greetings after the first message.\n5. Stay focused on clinic tasks (appointments, queries, information) only.\n6. NEVER use bullet points, numbering, or lists — speak in natural flowing sentences only.';

interface LLMConfig {
  model: string;
  temperature: number;
}

async function callGemini(messages: any[], system_prompt: string | undefined, cfg: LLMConfig): Promise<{ text: string; status: number; error?: string }> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY found');

  const filteredMessages = messages.filter(m => m.content && m.content.trim().length > 0);
  const contents: any[] = [];
  let lastRole = '';

  for (const m of filteredMessages) {
    const currentRole = m.role === 'assistant' ? 'model' : 'user';
    if (currentRole === lastRole) continue;
    contents.push({ role: currentRole, parts: [{ text: m.content }] });
    lastRole = currentRole;
  }

  if (contents.length > 0 && contents[0].role === 'model') {
    contents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  console.log(`[Gemini] model=${cfg.model} temp=${cfg.temperature} contents=${contents.length}`);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: system_prompt ? { parts: [{ text: system_prompt + VOICE_RULE }] } : undefined,
        contents,
        generationConfig: { temperature: cfg.temperature, maxOutputTokens: 500 }
      })
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errStr = data?.error?.message || JSON.stringify(data);
    console.error(`[Gemini] API Error ${res.status}:`, errStr);
    return { text: '', status: res.status, error: errStr };
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text, status: 200 };
}

function buildGroqMessages(messages: any[], system_prompt: string | undefined): any[] {
  const groqMessages: any[] = [];
  if (system_prompt) groqMessages.push({ role: 'system', content: system_prompt + VOICE_RULE });
  const filtered = messages.filter(m => m.content && m.content.trim().length > 0);
  for (const m of filtered) {
    groqMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
  }
  return groqMessages;
}

async function callGroq(messages: any[], system_prompt: string | undefined, cfg: LLMConfig): Promise<{ text: string; status: number; error?: string }> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) throw new Error('No GROQ_API_KEY found');

  const groqMessages = buildGroqMessages(messages, system_prompt);
  console.log(`[Groq] model=${cfg.model} temp=${cfg.temperature} messages=${groqMessages.length}`);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: cfg.model, messages: groqMessages, temperature: cfg.temperature, max_tokens: 500 })
  });

  // Read body once — don't return rawRes so body can't be double-consumed
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errStr = data?.error?.message || data?.error || JSON.stringify(data);
    console.error(`[Groq] API Error ${res.status}:`, errStr);
    return { text: '', status: res.status, error: errStr };
  }
  const text = data?.choices?.[0]?.message?.content || '';
  return { text, status: 200 };
}

async function streamGroq(messages: any[], system_prompt: string | undefined, cfg: LLMConfig): Promise<Response> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) throw new Error('No GROQ_API_KEY found');

  const groqMessages = buildGroqMessages(messages, system_prompt);
  console.log(`[Groq Stream] model=${cfg.model} messages=${groqMessages.length}`);

  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: cfg.model, messages: groqMessages, temperature: cfg.temperature, max_tokens: 500, stream: true })
  });
}

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const { messages, system_prompt, llm_provider, llm_model, llm_temperature, stream: streamReq } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    // Per-agent settings take precedence over the global env var
    const provider = (llm_provider || process.env.LLM_PROVIDER || 'groq').toLowerCase();

    const cfg: LLMConfig = {
      model: llm_model || (provider === 'groq' ? 'llama-3.1-8b-instant' : 'gemini-2.0-flash'),
      temperature: llm_temperature ?? (provider === 'groq' ? 0.2 : 0.3),
    };

    console.log(`[LLM] provider=${provider} model=${cfg.model} temp=${cfg.temperature} stream=${!!streamReq}`);

    // ── Groq streaming path ─────────────────────────────────────────────────
    if (streamReq && provider === 'groq') {
      const groqRes = await streamGroq(messages, system_prompt, cfg);
      if (!groqRes.ok) {
        const err = await groqRes.text();
        return NextResponse.json({ error: 'Groq stream failed', detail: err }, { status: 500 });
      }
      return new Response(groqRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const result = provider === 'groq'
      ? await callGroq(messages, system_prompt, cfg)
      : await callGemini(messages, system_prompt, cfg);

    if (result.status !== 200) {
      console.error(`[${provider.toUpperCase()}] API Error ${result.status}:`, result.error);
      return NextResponse.json({ error: 'LLM failed', detail: result.error, status: result.status }, { status: result.status === 429 ? 429 : 500 });
    }

    const { text } = result;

    console.log(`[${provider.toUpperCase()}] Reply: ${text.substring(0, 80)}...`);

    return NextResponse.json({
      response: text.trim(),
      provider,
      model: cfg.model,
      latency_ms: Date.now() - start
    });
  } catch (error: any) {
    console.error('Webcall respond error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
