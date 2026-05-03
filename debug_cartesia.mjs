import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const KEY = process.env.CARTESIA_API_KEY;
console.log("Testing Cartesia Key:", KEY?.substring(0, 5) + "...");

const ws = new WebSocket('wss://api.cartesia.ai/tts/websocket?api_key=' + KEY + '&cartesia_version=2024-06-10');

ws.on('open', () => {
  console.log("✅ Cartesia Connected!");
  ws.send(JSON.stringify({
    model_id: "sonic-3",
    voice: { mode: "id", id: "a0e99841-438c-4a64-b6a9-ae08223d6a2f" },
    output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: 16000 },
    transcript: "Hello, this is a test.",
    language: "en",
    continue: false
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log("Message Type:", msg.type);
  if (msg.type === 'error') console.error("❌ API Error:", msg.error);
});

ws.on('error', (e) => console.error("❌ Socket Error:", e.message));
ws.on('close', (c, r) => {
  console.log(`🔒 Closed: ${c} ${r}`);
  process.exit();
});

setTimeout(() => { console.log("Timeout"); ws.close(); }, 5000);
