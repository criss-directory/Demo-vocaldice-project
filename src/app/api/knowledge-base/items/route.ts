import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase(token: string) {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'),
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

// GET /api/knowledge-base/items?agent_id=xxx — list all items for agent
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.split(' ')[1]
  const supabase = getSupabase(token)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')

  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, type, name, url, file_path, file_size, attached, agent_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If agent_id provided, mark which items are attached to this agent
  const items = agentId
    ? data.map(item => ({ ...item, attached: item.agent_id === agentId }))
    : data

  return NextResponse.json({ items })
}

// PATCH /api/knowledge-base/items — toggle attach/detach
export async function PATCH(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.split(' ')[1]
  const supabase = getSupabase(token)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { id, attached, agentId } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('knowledge_base')
    .update({ attached, agent_id: attached ? agentId : null })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/knowledge-base/items — delete an item
export async function DELETE(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.split(' ')[1]
  const supabase = getSupabase(token)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { id, filePath } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Delete from storage if PDF
  if (filePath) {
    await supabase.storage.from('knowledge-base').remove([filePath])
  }

  const { error } = await supabase
    .from('knowledge_base')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
