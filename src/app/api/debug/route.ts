import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co')
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder')
  
  try {
    const authHeader = request.headers.get('Authorization')
    const supabaseOptions: any = {}
    
    if (authHeader) {
      supabaseOptions.global = { headers: { Authorization: authHeader } }
    }
    
    const supabase = createClient(url, key, supabaseOptions)
    
    // Attempt to get user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    // Attempt to fetch all agents (if authenticated, RLS will filter to own agents; if not, 0 rows)
    const { data: agents, error: agentsError } = await supabase.from('agents').select('*')
    
    // Also try a raw count
    const { count, error: countError } = await supabase.from('agents').select('*', { count: 'exact', head: true })

    return NextResponse.json({
      ok: true,
      hasAuthHeader: !!authHeader,
      user_id: user?.id || null,
      userError: userError?.message || null,
      agents_returned: agents?.length || 0,
      agents,
      agentsError: agentsError?.message || null,
      totalCount: count,
      countError: countError?.message || null
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
