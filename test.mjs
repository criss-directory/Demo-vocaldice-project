import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Connecting to Supabase...");
  
  // 1. Sign in with the user credentials to get a valid session
  // Wait, I don't know the user's password. 
  // Let me just sign up a dummy user to test the create API!
  const email = `test_${Date.now()}@test.com`;
  const password = `Password123!`;
  
  console.log(`Signing up dummy user ${email}...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    console.error("Signup failed:", authError.message);
    return;
  }
  
  const token = authData.session.access_token;
  console.log("Signup success! UID:", authData.user.id);
  
  // 2. Hit the /api/agent/create route running on localhost
  console.log("Hitting POST /api/agent/create with token...");
  try {
    const res = await fetch("http://localhost:3001/api/agent/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        clinicName: "Script Clinic",
        agentName: "ScriptBot",
        selectedLanguages: ["en"],
        selectedVoiceId: "mock-1",
        selectedVoiceName: "Aria",
        selectedUseCases: ["appointment"],
        faqs: []
      })
    });
    
    const text = await res.text();
    console.log("Create Agent HTTP Status:", res.status);
    console.log("Create Agent Response:", text);
    
    if (!res.ok) {
       console.error("Failed to create agent!");
       return;
    }
  } catch(e) {
    console.error("Fetch to API failed. Next.js server might not be running on 3001.", e);
  }

  // 3. Query the agents table using the authenticated client
  console.log("Querying agents table directly...");
  const { data: agents, error: agentsError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', authData.user.id);

  if (agentsError) {
    console.error("Failed to fetch agents:", agentsError);
  } else {
    console.log(`Found ${agents.length} agents for this user:`, JSON.stringify(agents, null, 2));
  }
}

run();
