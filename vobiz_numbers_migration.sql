-- Vobiz Virtual Numbers table
-- Links a Vobiz phone number to a specific agent for a user
CREATE TABLE IF NOT EXISTS vobiz_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  vobiz_auth_id TEXT,
  vobiz_auth_token TEXT,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone_number)
);

-- Enable RLS
ALTER TABLE vobiz_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies — users can only see/manage their own numbers
CREATE POLICY "Users can view their own vobiz numbers"
  ON vobiz_numbers FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own vobiz numbers"
  ON vobiz_numbers FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vobiz numbers"
  ON vobiz_numbers FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vobiz numbers"
  ON vobiz_numbers FOR DELETE USING (auth.uid() = user_id);

-- Allow the voice server (anon key) to read number mappings for incoming calls
CREATE POLICY "Anon can read active vobiz numbers"
  ON vobiz_numbers FOR SELECT USING (is_active = true);
