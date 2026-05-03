import { NextResponse } from 'next/server';
import {
  getPromptTemplate,
  injectVariables,
  formatFAQs,
  buildLangRuleBlock,
  stripLangRuleBlock,
  Language,
  UseCase,
  ClinicConfig,
  LANGUAGE_NAMES,
} from '@/lib/promptTemplates';

// ─────────────────────────────────────────────────────────────────────────────
// Build the merged system prompt
// If single language: use template directly
// If multiple languages: use Gemini to intelligently merge templates
// ─────────────────────────────────────────────────────────────────────────────
async function buildSystemPrompt(
  config: ClinicConfig,
  languages: Language[],
  useCases: UseCase[]
): Promise<string> {
  const primaryLang = languages[0];
  const primaryUseCase = useCases[0] ?? 'appointment_booking';

  // --- Single language, single use case: quick path ---
  if (languages.length === 1 && useCases.length === 1) {
    const template = getPromptTemplate(primaryLang, primaryUseCase);
    return injectVariables(template, config);
  }

  // --- Multi-language or multi-use-case: ask Gemini to merge ---
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    // Fallback: use primary language + primary use case
    const template = getPromptTemplate(primaryLang, primaryUseCase);
    return injectVariables(template, config);
  }

  // Collect all templates for the selected combinations
  const templates: string[] = [];
  for (const lang of languages) {
    for (const uc of useCases) {
      const raw = getPromptTemplate(lang, uc);
      templates.push(`=== ${LANGUAGE_NAMES[lang]} — ${uc.replace('_', ' ')} ===\n${injectVariables(raw, config)}`);
    }
  }

  const mergeInstruction = `You are an expert AI system prompt engineer.

The following are ${templates.length} language-specific and use-case-specific system prompts for the same AI clinic receptionist named "${config.agent_name}" at "${config.clinic_name}".

Your task: Merge them into ONE unified, coherent, professional system prompt that:
1. Supports ALL the listed languages naturally (auto-detect and match the caller's language).
2. Handles ALL the listed use cases.
3. Preserves all language-specific greetings, phrases, and conversation flows.
4. Is clean, ready to use as-is, and does NOT contain any meta-commentary or instructions to you.

The merged prompt must start by introducing the agent and listing all supported languages. Then have sections for each language/use-case combination. Do not duplicate clinic information — list it once at the top.

TEMPLATES TO MERGE:
---
${templates.join('\n\n')}
---

OUTPUT: Provide ONLY the merged system prompt. No preamble, no explanation.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: mergeInstruction }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
        }),
      }
    );

    if (!res.ok) {
      console.error('Gemini merge error:', await res.text());
      throw new Error('Gemini API failed');
    }

    const data = await res.json();
    const merged = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!merged) throw new Error('Empty Gemini response');
    return merged;
  } catch (e) {
    console.error('Gemini merge failed, using primary template:', e);
    const template = getPromptTemplate(primaryLang, primaryUseCase);
    return injectVariables(template, config);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agent/create
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      clinicName,
      agentName = 'Priya',
      clinicAddress = '',
      clinicPhone = '',
      doctorNames = '',
      specialization = '',
      services = '',
      appointmentInfo = '',
      emergencyContact = '',
      optionalInfo = '',
      workingHours: rawWorkingHours,
      workingHoursStart,
      workingHoursEnd,
      selectedLanguages = ['en'],
      selectedVoiceId = '',
      selectedVoiceName = '',
      selectedUseCases = ['appointment_booking'],
      faqs = [],
    } = body;

    // Accept either a pre-formatted string or start/end pair
    const workingHours = rawWorkingHours || (workingHoursStart && workingHoursEnd ? `${workingHoursStart} – ${workingHoursEnd}` : '9 AM – 6 PM');

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Build Config ──────────────────────────────────────────────────────────
    const languages = (selectedLanguages as string[]).map(l => l as Language);
    const useCases = (selectedUseCases as string[]).map(u => u as UseCase);
    const faqFormatted = formatFAQs(faqs as { q: string; a: string }[]);

    const config: ClinicConfig = {
      clinic_name: clinicName || 'Our Clinic',
      agent_name: agentName,
      clinic_address: clinicAddress || 'Please contact clinic for address',
      clinic_phone: clinicPhone || 'Please contact clinic',
      doctor_list: doctorNames || 'Our specialist doctors',
      working_hours: workingHours,
      specialties: specialization || '',
      faq_list: faqFormatted || 'No FAQs configured yet.',
      primary_language: languages[0] ?? 'en',
      supported_languages: languages.map(l => LANGUAGE_NAMES[l]).join(', '),
      use_cases: useCases.map(u => u.replace('_', ' ')).join(', '),
    };

    // ── Generate Prompt ───────────────────────────────────────────────────────
    let systemPrompt = await buildSystemPrompt(config, languages, useCases);

    // Append extra clinic context that wasn't in the base templates
    const extraLines: string[] = []
    if (services)         extraLines.push(`SERVICES OFFERED: ${services}`)
    if (appointmentInfo)  extraLines.push(`APPOINTMENT PROCESS: ${appointmentInfo}`)
    if (emergencyContact) extraLines.push(`EMERGENCY CONTACT: ${emergencyContact}`)
    if (optionalInfo)     extraLines.push(`ADDITIONAL INFORMATION: ${optionalInfo}`)
    if (extraLines.length > 0) {
      systemPrompt += '\n\n' + extraLines.join('\n')
    }

    // Strip any stale lang-rule block then append a fresh one for the selected languages.
    // This block overrides language instructions from the base template so the agent
    // handles all configured languages seamlessly and rejects unsupported ones.
    systemPrompt = stripLangRuleBlock(systemPrompt) + '\n\n' + buildLangRuleBlock(selectedLanguages)

    // ── Build language-appropriate first message ──────────────────────────────
    // This is what the agent speaks at the very start of every call.
    // Matches the primary language so callers immediately hear the right language.
    const FIRST_MSG_TEMPLATES: Record<string, string> = {
      te: `నమస్కారం! ${clinicName} కి call chesinanduku thanks. Nenu ${agentName}. Ela help cheyali?`,
      hi: `नमस्कार! ${clinicName} में आपका स्वागत है। मैं ${agentName} हूँ। आपकी कैसे मदद कर सकती हूँ?`,
      ta: `வணக்கம்! ${clinicName}-க்கு அழைத்தமைக்கு நன்றி. நான் ${agentName}. எவ்வாறு உதவலாம்?`,
      kn: `ನಮಸ್ಕಾರ! ${clinicName}ಗೆ ಕರೆ ಮಾಡಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದ. ನಾನು ${agentName}. ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`,
      ml: `നമസ്കാരം! ${clinicName}ലേക്ക് വിളിച്ചതിന് നന്ദി. ഞാൻ ${agentName}. എങ്ങനെ സഹായിക്കാം?`,
      mr: `नमस्कार! ${clinicName} मध्ये कॉल केल्याबद्दल धन्यवाद. मी ${agentName} आहे. मी आपली कशी मदत करू?`,
      gu: `નમસ્તે! ${clinicName}માં call કરવા બદલ આભાર. હું ${agentName} છું. હું તમારી કઈ રીતે મદદ કરી શકું?`,
      bn: `নমস্কার! ${clinicName}-এ call করার জন্য ধন্যবাদ। আমি ${agentName}। কীভাবে সাহায্য করতে পারি?`,
      en: `Thank you for calling ${clinicName}. This is ${agentName}, how may I help you today?`,
    }
    const firstMessage = FIRST_MSG_TEMPLATES[languages[0]] ?? FIRST_MSG_TEMPLATES.en

    // ── Insert Agent in Supabase ──────────────────────────────────────────────
    const PRESET_MAP: Record<string, string> = {
      te: 'telugu_v1', kn: 'kannada_v1', ta: 'tamil_v1',
      ml: 'malayalam_v1', hi: 'hindi_v1', en: 'english_in_v1',
      mr: 'marathi_v1', gu: 'gujarati_v1', bn: 'bengali_v1',
      pa: 'punjabi_v1', or: 'odia_v1'
    };
    const primaryPresetId = PRESET_MAP[languages[0]] || 'english_in_v1';
    
    const agentPayload = {
      user_id: user.id,
      name: `${clinicName} — ${agentName}`,
      clinic_name: clinicName,
      agent_name: agentName,
      clinic_address: clinicAddress,
      clinic_phone: clinicPhone,
      doctor_names: doctorNames,
      specialties: specialization ? [specialization] : [],
      working_hours: workingHours,
      languages: selectedLanguages,
      primary_language: languages[0],
      voice_id: selectedVoiceId,
      voice_name: selectedVoiceName,
      primary_preset_id: primaryPresetId,
      primary_voice_id: selectedVoiceId,
      fallback_voice_id: selectedVoiceId, // using same voice for english fallback for now
      use_cases: selectedUseCases,
      faqs: faqs,
      system_prompt: systemPrompt,
      stt_silence_timeout: 500, // Optimized VAD — 500ms is safe for natural speech
      status: 'ready',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('agents')
      .insert(agentPayload)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Insert failed: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, agentId: data.id, systemPrompt });
  } catch (err) {
    console.error('Agent creation error:', err);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
