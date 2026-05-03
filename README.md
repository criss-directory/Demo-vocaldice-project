# Vocaldice — AI Voice Receptionist for Medical Clinics

A full-stack SaaS platform giving medical clinics in South India a 24/7 AI receptionist that speaks Telugu, Tamil, Kannada, Malayalam, Hindi, and English.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Auth & DB**: Supabase
- **STT**: Sarvam AI (`saarika:v2`)
- **TTS**: Cartesia (`sonic-english`)
- **LLM**: Google Gemini 1.5 Flash
- **Voice**: WebRTC (browser MediaRecorder API)

---

## Setup

### 1. Install dependencies

```bash
cd "e:\Vocaldice Product\vocaldice"
npm install
```

### 2. Configure environment variables

The `.env.local` file is already pre-configured. If you need to update keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://gqmukyyqiohploxmmytf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_AP8xIfNEcI7d7xGBa09RfA_pCkY5Gg8
CARTESIA_API_KEY=sk_car_rFLLnkFm6n7h9jLgLbiECH
SARVAM_API_KEY=sk_y2nbv7dh_RRZoDZ3SOb0Pc7jEXVbRJ11k
GEMINI_API_KEY=AIzaSyBZxFHhJgTE14Ag_NIpv3mqUblyLZy0MQQ
```

### 3. Set up Supabase database

Run this SQL in your **Supabase → SQL Editor**:

```sql
create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  owner_name text, clinic_name text, email text, phone text,
  created_at timestamptz default now()
);

create table if not exists agent_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  clinic_name text, doctor_names text[], specialties text[],
  working_hours jsonb, languages text[], agent_voice text,
  clinic_address text, faqs jsonb, agent_prompt text,
  updated_at timestamptz default now()
);

alter table clinics enable row level security;
alter table agent_config enable row level security;

create policy "Own clinic" on clinics for all using (auth.uid() = user_id);
create policy "Own config" on agent_config for all using (auth.uid() = user_id);
```

### 4. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000`

---

## Voice Pipeline (Live Demo)

```
Browser Mic → MediaRecorder (4s chunks)
  → /api/stt  →  Sarvam AI (auto language detect)
  → /api/chat  →  Gemini 1.5 Flash (Priya persona)
  → /api/tts  →  Cartesia (MP3 bytes)
  → AudioContext → browser playback
```

## Deploy to Vercel

1. Push this folder to GitHub
2. Import in Vercel → add env vars → Deploy

## Project Structure

```
src/app/
├── page.tsx              Landing page
├── login/ signup/        Auth pages
├── api/stt chat tts/     Voice pipeline API routes
└── dashboard/            6 dashboard pages + layout
```
