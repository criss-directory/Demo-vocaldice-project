import dotenv from 'dotenv';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

process.on('uncaughtException', (err) => {
  console.error("🔥 UNCAUGHT EXCEPTION 🔥", err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error("🌊 UNHANDLED REJECTION 🌊", reason);
});

// --- CONFIG ---
const PORT = 3004;
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log(`🔑 Gemini Key: ${GEMINI_API_KEY?.substring(0, 15)}...`);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- TOOLS ---
const tools = [
  {
    functionDeclarations: [
      {
        name: "book_appointment",
        description: "Books an appointment for a patient at the clinic.",
        parameters: {
          type: "object",
          properties: {
            patientName: { type: "string" },
            doctorName: { type: "string" },
            time: { type: "string", description: "Format: HH:mm (e.g., 14:30)" },
            day: { type: "string" }
          },
          required: ["patientName", "time", "day"]
        }
      },
      {
        name: "transfer_to_receptionist",
        description: "Transfers the call to a human receptionist for emergencies or complex queries.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string" }
          }
        }
      }
    ]
  }
];

const wss = new WebSocketServer({ port: PORT });
console.log(`🎙️ Voice Orchestrator running on ws://localhost:${PORT}`);

// --- SESSION CLASS ---
class Session {
  constructor(clientWs, config) {
    this.clientWs = clientWs;
    this.systemPrompt = config.systemPrompt || "You are a helpful medical receptionist. Keep responses short and friendly.";
    this.language = config.language || 'te';
    this.voiceId = config.voiceId || '56e35e2d-6eb6-4226-ab8b-9776515a7094';
    this.firstMessage = config.firstMessage || "Hello! How can I help you today?";
    this.firstMessageMode = config.firstMessageMode || 'Assistant speaks first';
    
    this.history = [];
    this.chat = null;
    this.cartesiaWs = null;
    this.ttsQueue = [];
    this.cartesiaReady = false;
    this.isLlmThinking = false;
    this.isTtsSpeaking = false;
    this.interrupted = false;
    this.greetingSent = false;

    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];

    try {
      this.model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        tools: tools,
        systemInstruction: { role: 'system', parts: [{ text: this.systemPrompt }] },
        safetySettings: safetySettings
      });
      console.log("[Model] Initialized with system prompt");
    } catch (e) {
      console.error("[Gemini Model Error]", e);
      this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", tools: tools });
    }

    this.initChat();
  }

  initChat() {
    if (!this.model) throw new Error("Model not initialized");
    this.chat = this.model.startChat({
      history: [],
      generationConfig: { maxOutputTokens: 150, temperature: 0.3 }
    });
  }

  initCartesia() {
    if (!CARTESIA_API_KEY) { 
      console.error("[Cartesia] Missing API Key"); 
      return; 
    }
    
    const startTime = Date.now();
    this.cartesiaWs = new WebSocket('wss://api.cartesia.ai/tts/websocket?api_key=' + CARTESIA_API_KEY + '&cartesia_version=2024-06-10');
    
    this.cartesiaWs.on('open', () => {
      console.log(`[Cartesia] Connected (${Date.now() - startTime}ms)`);
      this.cartesiaReady = true;
      
      // Only send greeting if mode is "Assistant speaks first"
      if (this.firstMessageMode === 'Assistant speaks first' && this.firstMessage && !this.greetingSent) {
        console.log(`[Greeting] Mode: Assistant speaks first, sending greeting...`);
        this.greetingSent = true;
        
        // Send greeting immediately
        this.sendGreeting();
      } else {
        console.log(`[Greeting] Mode: User speaks first, waiting for user input...`);
        // Send ready message to client to indicate it's listening
        this.clientWs.send(JSON.stringify({ type: 'ready', text: 'Listening for user input...' }));
      }
    });

    this.cartesiaWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        
        if (msg.type === 'error') {
          console.error("[Cartesia Error]", msg.error || msg);
          return;
        }
        
        if (msg.type === 'chunk' && msg.data) {
          const audioBuffer = Buffer.from(msg.data, 'base64');
          this.clientWs.send(audioBuffer);
        }
        
        if (msg.type === 'done') {
          console.log("[Cartesia] Done");
          this.isTtsSpeaking = false;
          this.clientWs.send(JSON.stringify({ type: 'tts_complete' }));
        }
      } catch (e) {
        console.error("[Cartesia Message Error]", e.message);
      }
    });

    this.cartesiaWs.on('error', (e) => console.error(`[Cartesia Error]`, e.message));
    this.cartesiaWs.on('close', (c, r) => {
      console.log(`[Cartesia Close] Code: ${c}`);
      this.cartesiaReady = false;
    });
  }

  async sendGreeting() {
    // Send greeting as AI message
    this.clientWs.send(JSON.stringify({ 
      type: 'llm_text', 
      text: this.firstMessage 
    }));
    
    // Add to history
    this.history.push({ role: 'model', content: this.firstMessage });
    
    console.log(`[Greeting] Speaking: "${this.firstMessage.substring(0, 50)}..."`);
    
    // Speak it immediately - no delay
    this.speakText(this.firstMessage, false);
  }

  speakText(text, shouldContinue = true) {
    if (!text || !text.trim()) return;
    
    if (!this.cartesiaWs || this.cartesiaWs.readyState !== WebSocket.OPEN) {
      console.log(`[TTS Queue] Buffering: "${text.substring(0, 30)}..."`);
      this.ttsQueue.push(text);
      return;
    }
    
    this.isTtsSpeaking = true;
    // Cartesia sonic-multilingual supports: en, hi, es, fr, de, it, pt, ja, zh, ko, nl, pl, ru, sv, tr
    // Indian regional languages (te, ta, kn, ml) fall back to Hindi for best intelligibility
    const cartesiaLangMap = { hi: 'hi', en: 'en', te: 'hi', ta: 'hi', kn: 'hi', ml: 'hi' };
    const cLang = cartesiaLangMap[this.language] || 'en';

    try {
      this.cartesiaWs.send(JSON.stringify({
        model_id: "sonic-multilingual",
        voice: { mode: "id", id: this.voiceId },
        output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: 16000 },
        context_id: `call${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, ''),
        transcript: text,
        language: cLang,
        continue: shouldContinue
      }));
    } catch (e) {
      console.error("[Cartesia Send Error]", e);
    }
  }

  async processMessage(text) {
    if (this.isLlmThinking) {
      console.log("[LLM] Already thinking, skipping");
      return;
    }
    this.isLlmThinking = true;
    this.interrupted = false;

    try {
      // Add user message to history
      this.history.push({ role: 'user', content: text });
      
      console.log(`[User]: ${text}`);
      
      let result = await this.chat.sendMessage(text);
      let fullReply = "";

      // Process response
      const response = result.response;
      const functionCalls = response.functionCalls();
      
      if (functionCalls && functionCalls.length > 0) {
        console.log(`[Tool Call]: ${functionCalls[0].name}`, functionCalls[0].args);
        const toolResponse = await this.handleToolCall(functionCalls[0]);
        result = await this.chat.sendMessage([{ functionResponse: { name: functionCalls[0].name, response: toolResponse } }]);
      }

      fullReply = result.response.text();
      
      if (fullReply) {
        console.log(`[AI]: ${fullReply}`);
        
        // Send text to frontend
        this.clientWs.send(JSON.stringify({ type: 'llm_text', text: fullReply }));
        
        // Add to history
        this.history.push({ role: 'model', content: fullReply });
        
        // Speak it
        this.speakText(fullReply, false);
      }
    } catch (e) {
      console.error(`[Gemini Error]:`, e);
      this.clientWs.send(JSON.stringify({ type: 'error', text: 'LLM Error: ' + e.message }));
    } finally {
      this.isLlmThinking = false;
    }
  }

  async handleToolCall(call) {
    if (call.name === 'book_appointment') {
      const { patientName, doctorName, time, day } = call.args;
      const msg = `Appointment booked for ${patientName} on ${day} at ${time}${doctorName ? ' with Dr. ' + doctorName : ''}.`;
      this.speakText(msg);
      return { status: "success", message: msg };
    }
    if (call.name === 'transfer_to_receptionist') {
      const msg = "Transferring you to a human receptionist now.";
      this.speakText(msg);
      return { status: "success", message: msg };
    }
    return { error: "Unknown tool" };
  }

  interrupt() {
    this.interrupted = true;
    if (this.cartesiaWs?.readyState === WebSocket.OPEN) {
      this.cartesiaWs.send(JSON.stringify({ type: 'cancel', context_id: 'call-context' }));
    }
    this.clientWs.send(JSON.stringify({ type: 'interrupt' }));
    this.isTtsSpeaking = false;
  }

  close() {
    if (this.cartesiaWs) this.cartesiaWs.close();
  }
}

// --- WS HANDLER ---
const sessions = new Map();

wss.on('connection', (ws) => {
  console.log(`[Client] Connected`);
  let session = null;

  ws.on('message', async (data, isBinary) => {
    if (isBinary) return;
    
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      console.error("[WS] Parse Error:", data.toString().substring(0, 50));
      return;
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (msg.type === 'init') {
      console.log(`[Init] Language: ${msg.language}, Voice: ${msg.voiceId}`);
      console.log(`[Init] Prompt: ${(msg.systemPrompt || 'default').substring(0, 80)}...`);
      console.log(`[Init] FirstMsg: ${msg.firstMessage}`);
      console.log(`[Init] FirstMsgMode: ${msg.firstMessageMode}`);
      
      try {
        session = new Session(ws, msg);
        sessions.set(ws, session);
        
        // Tell client we're setting up
        ws.send(JSON.stringify({ type: 'connecting', message: 'Setting up voice...' }));
        
        // Initialize Cartesia (which will send greeting)
        session.initCartesia();
        
        // Send ready immediately so client can start listening
        ws.send(JSON.stringify({ type: 'ready' }));
      } catch (e) {
        console.error("[Init Error]", e);
        ws.send(JSON.stringify({ type: 'error', text: e.message }));
      }
    }
    
    if (msg.type === 'transcript') {
      console.log(`[User]: ${msg.text}`);
      
      // Interrupt any current speech
      if (session?.isTtsSpeaking) {
        session.interrupt();
      }
      
      // Echo transcript to frontend
      ws.send(JSON.stringify({ type: 'transcript', text: msg.text, isFinal: true }));
      
      // Process with LLM
      if (session) {
        session.processMessage(msg.text);
      }
    }
    
    if (msg.type === 'speech_start') {
      console.log(`[Speech] User started speaking`);
      if (session?.isTtsSpeaking) {
        session.interrupt();
      }
    }
  });

  ws.on('close', () => {
    console.log(`[Client] Disconnected`);
    if (session) {
      session.close();
      sessions.delete(ws);
    }
  });

  ws.on('error', (e) => console.error("[WS Error]", e.message));
});

console.log("✅ Voice Orchestrator ready. Waiting for connections...");
