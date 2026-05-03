import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const KEY = process.env.SARVAM_API_KEY;
console.log("Testing Sarvam Key:", KEY?.substring(0, 5) + "...");

const ws = new WebSocket('wss://api.sarvam.ai/speech-to-text-translate/ws', {
  headers: { 'api-subscription-key': KEY }
});

ws.on('open', () => {
  console.log("✅ Sarvam Connected!");
  ws.send(JSON.stringify({
    config: {
      model: "saaras_v3",
      language: "en-IN",
      sampling_rate: 16000,
      encoding: "pcm_s16le"
    }
  }));
});

ws.on('message', (data) => {
  console.log("Sarvam Msg:", data.toString());
});

ws.on('error', (e) => console.error("❌ Socket Error:", e.message));
ws.on('close', (c, r) => {
  console.log(`🔒 Closed: ${c} ${r}`);
  process.exit();
});

setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) { console.log("Timeout connecting..."); process.exit(); } }, 5000);
