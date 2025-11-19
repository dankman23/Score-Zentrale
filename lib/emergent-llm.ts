/**
 * Emergent LLM Integration
 * Direct API calls to Emergent's LLM endpoint
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface EmergentChatOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  messages: ChatMessage[]
}

interface EmergentChatResponse {
  choices: Array<{
    message: {
      content: string
      role: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Sends a chat completion request to Emergent's LLM API
 */
export async function emergentChatCompletion(
  options: EmergentChatOptions,
  retries = 2
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY // OpenAI or Emergent Key
  
  console.log(`[EmergentLLM] API Key present: ${!!apiKey}, starts with sk-: ${apiKey?.startsWith('sk-')}`)
  
  if (!apiKey) {
    throw new Error('OpenAI API Key not configured - missing from environment')
  }
  
  if (!apiKey.startsWith('sk-')) {
    throw new Error(`OpenAI API Key invalid format - got: ${apiKey.substring(0, 10)}...`)
  }

  const requestBody = {
    model: options.model || 'gpt-4',
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 1000
  }

  let lastError: Error | null = null
  
  // Use OpenAI endpoint with Emergent Universal Key
  const apiEndpoint = 'https://api.openai.com/v1/chat/completions'
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Emergent API error (${response.status}): ${errorText}`)
      }

      const data: EmergentChatResponse = await response.json()
      
      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from Emergent API')
      }

      return data.choices[0].message.content

    } catch (error: any) {
      lastError = error
      console.error(`[EmergentLLM] Attempt ${attempt + 1} failed:`, error.message)
      
      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Failed to get response from Emergent API')
}

/**
 * Helper function to get structured JSON output
 */
export async function emergentGetJSON(
  systemPrompt: string,
  userPrompt: string,
  retries = 2
): Promise<any> {
  const response = await emergentChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1500
  }, retries)

  // Try to extract JSON from response
  try {
    // Remove markdown code blocks if present
    let jsonString = response
    const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1]
    }
    
    // Find JSON object
    const jsonMatch = jsonString.match(/{[\s\S]*}/)
    if (jsonMatch) {
      jsonString = jsonMatch[0]
    }
    
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('[EmergentLLM] Failed to parse JSON:', error)
    console.error('[EmergentLLM] Raw response:', response)
    throw new Error('Failed to parse JSON from Emergent API response')
  }
}
