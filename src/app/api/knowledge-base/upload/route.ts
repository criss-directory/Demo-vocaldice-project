import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'),
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'),
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const agentId = formData.get('agent_id') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file type
    if (!file.type.includes('pdf') && !file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('knowledge-base')
      .upload(fileName, fileBuffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 })
    }

    // Extract text from PDF using basic approach (read as text-extractable)
    // For now, store the raw content as a note that it needs processing
    // In production you'd use a PDF parsing library
    const content = `[PDF: ${file.name}] Content available in storage at ${uploadData.path}`

    // Save record to knowledge_base table
    const { data: kbRecord, error: kbError } = await supabase
      .from('knowledge_base')
      .insert({
        user_id: user.id,
        agent_id: agentId || null,
        type: 'pdf',
        name: file.name,
        content,
        file_path: uploadData.path,
        file_size: file.size,
        attached: agentId ? true : false,
      })
      .select()
      .single()

    if (kbError) {
      console.error('KB insert error:', kbError)
      return NextResponse.json({ error: 'DB insert failed: ' + kbError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, item: kbRecord })
  } catch (err) {
    console.error('Knowledge base upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
