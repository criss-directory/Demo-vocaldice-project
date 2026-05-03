-- ============================================================
-- VOCALDICE: Call Logs Table Migration
-- Run this in: Supabase → SQL Editor
-- ============================================================

create table if not exists call_logs (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid references agents(id) on delete cascade,
  agent_name        text not null,

  -- Call metadata
  call_date         timestamptz not null default now(),
  call_type         text not null default 'Web Call',       -- 'Web Call' | 'Phone Call'
  from_number       text not null default 'Web Call',
  to_number         text not null default 'Assistant',
  duration_seconds  int not null default 0,

  -- Outcome
  status            text not null default 'completed',      -- 'completed' | 'missed' | 'failed' | 'in-progress'
  ended_by          text not null default 'User',           -- 'User' | 'System' | 'Agent'
  cost              numeric(10, 4) not null default 0,

  -- Content
  language          text default 'English',
  summary           text default '',
  transcript        text default '',
  transcript_json   jsonb default '[]'::jsonb,   -- [{role, content, timestamp}]
  analysis          jsonb default '{}'::jsonb,   -- post-call extracted fields

  created_at        timestamptz default now()
);

-- Enable Row Level Security
alter table call_logs enable row level security;

-- Policy: users can access call_logs for their own agents
create policy "Own call logs" on call_logs
  for all
  using (
    agent_id in (select id from agents where user_id = auth.uid())
  )
  with check (
    agent_id in (select id from agents where user_id = auth.uid())
  );

-- Index for fast agent-based queries
create index if not exists idx_call_logs_agent_id on call_logs(agent_id);
create index if not exists idx_call_logs_call_date on call_logs(call_date desc);

-- ============================================================
-- If table already exists, run these to add the new columns:
-- ============================================================
-- alter table call_logs add column if not exists transcript_json jsonb default '[]'::jsonb;
-- alter table call_logs add column if not exists analysis jsonb default '{}'::jsonb;
