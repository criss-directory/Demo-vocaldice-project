import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const start = Date.now();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const languageCode = formData.get('language_code') as string || 'en-IN';
    const sttModel = formData.get('stt_model') as string || 'saarika:v2.5';
    const noiseReducer = formData.get('stt_noise_reducer') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
    if (!SARVAM_API_KEY) throw new Error('Missing SARVAM_API_KEY');

    console.log(`STT Request: lang=${languageCode}, model=${sttModel}, noise_reducer=${noiseReducer}, size=${file.size} bytes`);

    // Create a new FormData object to proxy the file
    const proxyData = new FormData();
    proxyData.append('file', file, 'audio.webm');
    proxyData.append('language_code', languageCode);
    proxyData.append('model', sttModel);
    // with_disfluences=true keeps "um/ah" in transcript; noise reducer removes them
    proxyData.append('with_disfluences', noiseReducer ? 'false' : 'true');

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'api-subscription-key': SARVAM_API_KEY
      },
      body: proxyData
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Sarvam STT Error:', res.status, errText);
      return NextResponse.json({ error: `Sarvam STT failed: ${res.status}`, detail: errText }, { status: 500 });
    }

    const data = await res.json();
    console.log('Sarvam STT Response:', JSON.stringify(data));
    return NextResponse.json({
      transcript: data.transcript || '',
      detected_language: data.language_code || null,
      latency_ms: Date.now() - start
    });
  } catch (error: any) {
    console.error('Webcall transcribe error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
