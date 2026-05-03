import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const PORT = 3003;
const API_KEY = process.env.SARVAM_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

console.log('🎙️ Voice Agent Test Client');
console.log('==========================\n');

// Connect to orchestrator
const ws = new WebSocket(`ws://localhost:${PORT}`);

ws.on('open', () => {
  console.log('✅ Connected to orchestrator\n');
  
  // Initialize session
  ws.send(JSON.stringify({
    type: 'init',
    systemPrompt: 'You are a helpful medical receptionist. Keep responses short and friendly.',
    firstMessage: 'Hello! How can I help you today?',
    language: 'en',
    voiceId: 'a0e99841-438c-4a64-b6a9-ae08223d6a2f'
  }));
});

ws.on('message', (data) => {
  if (data instanceof Buffer) {
    console.log(`[TTS Audio] ${data.length} bytes received`);
    return;
  }
  
  const msg = JSON.parse(data.toString());
  
  switch (msg.type) {
    case 'ready':
      console.log('✅ Server ready - AI will greet you shortly\n');
      break;
    case 'llm_text':
      process.stdout.write(`🤖 AI: ${msg.text}`);
      break;
    case 'transcript':
      console.log(`\n👤 You: ${msg.text}\n`);
      break;
    case 'latency':
      console.log(`\n⏱️  Latency: ${JSON.stringify(msg.data)}\n`);
      break;
    case 'tts_complete':
      console.log('\n✅ TTS Complete\n');
      break;
    case 'error':
      console.error('❌ Error:', msg.text);
      break;
    default:
      console.log(`[${msg.type || 'unknown'}]`, JSON.stringify(msg).substring(0, 100));
  }
});

ws.on('error', (e) => {
  console.error('❌ WebSocket Error:', e.message);
});

ws.on('close', () => {
  console.log('\n🔒 Disconnected');
  process.exit();
});

// CLI input for testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Type a message and press Enter to send to the AI (after greeting)...\n');

rl.on('line', (input) => {
  if (ws.readyState === WebSocket.OPEN) {
    // For testing, we'll simulate speech by sending text
    console.log(`Sending: ${input}`);
    // Note: In real use, audio would be sent from the mic
  }
});

setTimeout(() => {
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('❌ Could not connect to orchestrator');
    console.log('\nMake sure the orchestrator is running:');
    console.log('  npm run dev:voice\n');
    process.exit(1);
  }
}, 5000);
