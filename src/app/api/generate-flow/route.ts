import { NextRequest, NextResponse } from 'next/server'
import { getPromptTemplate, injectVariables, formatFAQs, ClinicConfig } from '@/lib/promptTemplates'

export async function POST(req: NextRequest) {
  try {
    const { agent } = await req.json()
    if (!agent) {
      return NextResponse.json({ error: 'Missing agent data' }, { status: 400 })
    }

    // Extract languages and determine primary language
    const languages = agent.languages || ['en']
    const primaryLanguage = languages[0] || 'en'

    // Extract use cases and determine primary use case
    const useCases = agent.use_cases || ['appointment_booking']
    const primaryUseCase = useCases.includes('appointment_booking') ? 'appointment_booking' : 'enquiry_handling'

    // Format FAQs
    const faqList = agent.faqs && agent.faqs.length > 0 ? formatFAQs(agent.faqs) : 'No specific FAQs provided.'

    // Build config object for prompt templates
    const config: ClinicConfig = {
      clinic_name: agent.clinic_name || 'the clinic',
      agent_name: agent.agent_name || 'Assistant',
      clinic_address: agent.location || 'our location',
      clinic_phone: 'our contact number',
      doctor_list: (agent.doctors || []).map((d: any) => d.name || '').join(', ') || 'our doctors',
      working_hours: 'our normal working hours',
      specialties: 'our medical specialties',
      faq_list: faqList,
      primary_language: primaryLanguage,
      supported_languages: languages.join(', '),
      use_cases: useCases.join(', ')
    }

    // Get the base template and inject variables
    const baseTemplate = getPromptTemplate(primaryLanguage, primaryUseCase)
    const fullPrompt = injectVariables(baseTemplate, config)

    // Now we split the prompt into logical sections
    // Instead of calling the LLM directly on the fly which is slow and error-prone,
    // we can parse the base template structure if it's predictable, or use a heuristic.
    // Given the templates follow a standard markdown structure (## CONVERSATION FLOW, ## RULES, etc.),
    // we can use regex or string matching to split.
    
    // For simplicity and reliability, since the structure is fairly static:
    
    // We will attempt to categorize the generated text into the 8 required sections.
    // If we want Gemini to do it, we can call Gemini. Let's call Gemini to do this intelligently.
    const apiKey = process.env.GEMINI_API_KEY || process.env.Google_gemini_API_Key
    if (!apiKey) {
      return NextResponse.json({ error: 'No Gemini API key' }, { status: 500 })
    }

    const geminiSystemPrompt = `You are a helpful assistant. I will provide you with a master AI Receptionist system prompt.
Your task is to break it down into the following 8 sections, returning JSON format:
{
  "Agent Identity & Purpose": "...",
  "Understand Caller Intent": "...",
  "Provide Practice Information": "...",
  "Appointment Booking": "...",
  "Out of Scope Handling": "...",
  "Closing Statement": "...",
  "Agent Knowledge & Context": "...",
  "FAQ Examples": "..."
}
Map the information from the master prompt to these sections intelligently. Don't lose any critical details.`

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: geminiSystemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      throw new Error('Gemini API failed')
    }

    const data = await res.json()
    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (contentText) {
      const parsedFlow = JSON.parse(contentText)
      return NextResponse.json({ flow: parsedFlow })
    }

    throw new Error('Could not parse generateContent response')
  } catch (err: any) {
    console.error('Error in /api/generate-flow:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
