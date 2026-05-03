import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Simple HTML text extractor
function extractTextFromHtml(html: string): string {
  // Remove scripts and styles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
  // Replace block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  // Limit to 20000 chars
  return text.slice(0, 20000)
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { url, agentId } = await request.json()
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Fetch and extract content
    const fetchRes = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VocalDice-Bot/1.0)' },
      signal: AbortSignal.timeout(15000),
    })

    if (!fetchRes.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${fetchRes.status}` }, { status: 400 })
    }

    const contentType = fetchRes.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return NextResponse.json({ error: 'URL must point to a webpage' }, { status: 400 })
    }

    const html = await fetchRes.text()
    const content = extractTextFromHtml(html)

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const pageName = titleMatch ? titleMatch[1].trim().slice(0, 100) : parsedUrl.hostname

    // Save to knowledge_base table
    const { data: kbRecord, error: kbError } = await supabase
      .from('knowledge_base')
      .insert({
        user_id: user.id,
        agent_id: agentId || null,
        type: 'url',
        name: pageName,
        url: url,
        content,
        file_path: null,
        file_size: content.length,
        attached: agentId ? true : false,
      })
      .select()
      .single()

    if (kbError) {
      console.error('KB insert error:', kbError)
      return NextResponse.json({ error: 'DB insert failed: ' + kbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: kbRecord, contentLength: content.length })
  } catch (err) {
    console.error('Scrape error:', err)
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 })
  }
}
