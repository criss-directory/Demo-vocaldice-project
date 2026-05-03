import { NextRequest, NextResponse } from 'next/server'

const PREVIEW_TEXT: Record<string, string> = {
  te: 'నమస్కారం! నేను మీ AI రిసెప్షనిస్ట్ ని. మీకు ఎలా సహాయం చేయగలను?',
  hi: 'नमस्ते! मैं आपका AI रिसेप्शनिस्ट हूं। मैं आपकी कैसे मदद कर सकता हूं?',
  ta: 'வணக்கம்! நான் உங்கள் AI ரிசெப்ஷனிஸ்ட். நான் எப்படி உதவலாம்?',
  kn: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ AI ರಿಸೆಪ್ಷನಿಸ್ಟ್. ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
  ml: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ AI റിസെപ്ഷനിസ്റ്റ് ആണ്. എനിക്ക് എങ്ങനെ സഹായിക്കാം?',
  mr: 'नमस्कार! मी तुमचा AI रिसेप्शनिस्ट आहे. मी तुम्हाला कशी मदत करू शकतो?',
  gu: 'નમસ્તે! હું તમારો AI રિસેપ્શનિસ્ટ છું. હું તમને કેવી રીતે મદદ કરી શકું?',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡਾ AI ਰਿਸੈਪਸ਼ਨਿਸਟ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?',
  bn: 'নমস্কার! আমি আপনার AI রিসেপশনিস্ট। আমি কীভাবে সাহায্য করতে পারি?',
  en: 'Hello! I am your AI receptionist. How can I help you today?',
}

const SARVAM_LANG_CODE: Record<string, string> = {
  te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN',
  mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN', bn: 'bn-IN', en: 'en-IN',
}

export async function GET(req: NextRequest) {
  const speaker  = req.nextUrl.searchParams.get('speaker') || 'meera'
  const language = req.nextUrl.searchParams.get('language') || 'hi'

  const SARVAM_API_KEY = process.env.SARVAM_API_KEY
  if (!SARVAM_API_KEY) {
    return NextResponse.json({ error: 'Missing SARVAM_API_KEY' }, { status: 500 })
  }

  const langCode   = SARVAM_LANG_CODE[language] || 'hi-IN'
  const sampleText = PREVIEW_TEXT[language] || PREVIEW_TEXT['en']

  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: [sampleText],
        target_language_code: langCode,
        speaker,
        model: 'bulbul:v2',
        enable_preprocessing: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Sarvam TTS failed', detail: err }, { status: 500 })
    }

    const data = await res.json()
    const base64: string | undefined = data.audios?.[0]
    if (!base64) return NextResponse.json({ error: 'No audio returned' }, { status: 500 })

    const audioBuffer = Buffer.from(base64, 'base64')
    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
