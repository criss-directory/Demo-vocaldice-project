-- ============================================================
-- VOCALDICE: Agents Table Migration
-- Run this in: Supabase → SQL Editor
-- ============================================================

-- Drop old agents table if it exists (incompatible schema)
drop table if exists agents cascade;

-- Create the new agents table with full flat schema
create table if not exists agents (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,

  -- Identity
  name              text,
  agent_name        text not null default 'Priya',
  clinic_name       text not null,
  clinic_address    text,
  clinic_phone      text,

  -- Doctors & Schedule
  doctor_names      text,
  specialties       text[],
  working_hours     text,

  -- Voice & Language
  languages         text[] not null default '{en}',
  primary_language  text not null default 'en',
  voice_id          text,
  voice_name        text,

  -- Behavior
  use_cases         text[] not null default '{appointment_booking}',
  faqs              jsonb default '[]',

  -- The auto-generated (and editable) system prompt
  system_prompt     text,

  -- Status: 'ready' | 'live' | 'paused'
  status            text not null default 'ready',
  phone_number      text,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Enable Row Level Security
alter table agents enable row level security;

-- Policy: users can only access their own agent
create policy "Own agent" on agents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger to keep updated_at fresh
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger agents_updated_at
  before update on agents
  for each row execute function update_updated_at_column();
