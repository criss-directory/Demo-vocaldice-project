import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const INDIAN_LANGS = new Set(['te', 'hi', 'ta', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn', 'or'])

const SARVAM_SPEAKERS = [
  { id: 'sarvam:meera',     name: 'Meera',     gender: 'Female', description: 'Warm & professional female voice', provider: 'sarvam', language: 'multi' },
  { id: 'sarvam:pavithra',  name: 'Pavithra',  gender: 'Female', description: 'Clear & confident female voice',  provider: 'sarvam', language: 'multi' },
  { id: 'sarvam:maitreyi', name: 'Maitreyi',  gender: 'Female', description: 'Gentle & expressive female voice', provider: 'sarvam', language: 'multi' },
  { id: 'sarvam:arvind',   name: 'Arvind',    gender: 'Male',   description: 'Authoritative male voice',         provider: 'sarvam', language: 'multi' },
  { id: 'sarvam:amol',     name: 'Amol',      gender: 'Male',   description: 'Friendly & natural male voice',   provider: 'sarvam', language: 'multi' },
  { id: 'sarvam:amartya',  name: 'Amartya',   gender: 'Male',   description: 'Deep & professional male voice',  provider: 'sarvam', language: 'multi' },
]

const LANG_ALIASES: Record<string, string[]> = {
  en: ['en', 'english'],
  hi: ['hi', 'hindi'],
  te: ['te', 'telugu'],
  ta: ['ta', 'tamil'],
  kn: ['kn', 'kannada'],
  ml: ['ml', 'malayalam'],
  mr: ['mr', 'marathi'],
  gu: ['gu', 'gujarati'],
  pa: ['pa', 'punjabi'],
  bn: ['bn', 'bengali'],
  es: ['es', 'spanish'],
  fr: ['fr', 'french'],
  de: ['de', 'german'],
  pt: ['pt', 'portuguese'],
  ja: ['ja', 'japanese'],
  zh: ['zh', 'chinese'],
  ko: ['ko', 'korean'],
  ar: ['ar', 'arabic'],
}

export async function GET(req: NextRequest) {
  // Accept ?languages=te,hi,en (multi) or legacy ?language=te (single)
  const langsParam   = req.nextUrl.searchParams.get('languages') || req.nextUrl.searchParams.get('language') || ''
  const selectedLangs = langsParam.split(',').map(l => l.trim()).filter(Boolean)

  const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY
  if (!CARTESIA_API_KEY) {
    return NextResponse.json({ error: 'Missing CARTESIA_API_KEY' }, { status: 500 })
  }

  try {
    // Pass language filter + expand preview URLs directly to Cartesia
    const cartesiaUrl = new URL('https://api.cartesia.ai/voices')
    if (selectedLangs.length === 1) cartesiaUrl.searchParams.set('language', selectedLangs[0])
    cartesiaUrl.searchParams.set('limit', '100')
    // expand[]=preview_file_url must be in the raw query string (brackets don't encode cleanly via URLSearchParams)
    const cartesiaFetchUrl = `${cartesiaUrl.toString()}&expand[]=preview_file_url`

    const res = await fetch(cartesiaFetchUrl, {
      headers: {
        'X-API-Key': CARTESIA_API_KEY,
        'Cartesia-Version': '2024-06-10',
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[Voices] Cartesia error:', res.status, err)
      return NextResponse.json({ error: 'Failed to fetch voices', detail: err }, { status: res.status })
    }

    const data = await res.json()
    const allVoices: any[] = Array.isArray(data) ? data : (data.voices || [])

    // Build set of all alias strings for the selected languages
    const targetAliases = new Set<string>()
    for (const lang of selectedLangs) {
      const aliases = LANG_ALIASES[lang] || [lang]
      aliases.forEach(a => targetAliases.add(a))
    }

    let cartesiaVoices = allVoices

    if (selectedLangs.length > 0) {
      // Include voice if its language field matches ANY selected language
      const filtered = allVoices.filter(v => {
        const vLang = (v.language || '').toLowerCase()
        return [...targetAliases].some(t => vLang === t || vLang.startsWith(t))
      })
      // Fall back to all voices only if nothing matched at all
      cartesiaVoices = filtered.length > 0 ? filtered : allVoices
    }

    const normalizedCartesia = cartesiaVoices.map(v => ({
      id: v.id,
      name: v.name,
      description: v.description || '',
      language: v.language || 'en',
      gender: v.gender || '',
      tags: v.tags || [],
      preview_file_url: v.preview_url || v.preview_file_url || null,
      provider: 'cartesia' as const,
    }))

    // Include Sarvam voices when any Indian language is selected
    const hasIndianLang = selectedLangs.some(l => INDIAN_LANGS.has(l))
    const sarvamVoices = hasIndianLang ? SARVAM_SPEAKERS.map(s => ({
      ...s,
      tags: [],
      preview_file_url: null, // generated on demand via /api/voices/preview
    })) : []

    const voices = [...normalizedCartesia, ...sarvamVoices]

    console.log(`[Voices] langs=${selectedLangs.join(',') || 'all'} cartesia=${normalizedCartesia.length} sarvam=${sarvamVoices.length}`)
    return NextResponse.json({ voices })

  } catch (err: any) {
    console.error('[Voices] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
