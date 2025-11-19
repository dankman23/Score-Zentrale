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
 * Supports both old format (messages, options) and new format (options object)
 */
export async function emergentChatCompletion(
  messagesOrOptions: ChatMessage[] | EmergentChatOptions,
  optionsOrRetries?: { model?: string; temperature?: number; max_tokens?: number } | number,
  retries = 2
): Promise<string> {
  const apiKey = process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY
  
  console.log(`[EmergentLLM] API Key present: ${!!apiKey}, starts with sk-: ${apiKey?.startsWith('sk-')}`)
  
  if (!apiKey) {
    throw new Error('LLM API Key not configured - missing EMERGENT_LLM_KEY or OPENAI_API_KEY')
  }
  
  if (!apiKey.startsWith('sk-')) {
    throw new Error(`LLM API Key invalid format - got: ${apiKey.substring(0, 10)}...`)
  }

  // Handle both old and new calling formats
  let messages: ChatMessage[]
  let model: string
  let temperature: number
  let max_tokens: number
  
  if (Array.isArray(messagesOrOptions)) {
    // Old format: emergentChatCompletion(messages, {model, temperature, max_tokens})
    messages = messagesOrOptions
    const opts = (optionsOrRetries as any) || {}
    model = opts.model || 'gpt-4o-mini'
    temperature = opts.temperature ?? 0.3
    max_tokens = opts.max_tokens ?? 1000
    if (typeof optionsOrRetries === 'number') {
      retries = optionsOrRetries
    }
  } else {
    // New format: emergentChatCompletion({messages, model, temperature, max_tokens})
    messages = messagesOrOptions.messages
    model = messagesOrOptions.model || 'gpt-4o-mini'
    temperature = messagesOrOptions.temperature ?? 0.3
    max_tokens = messagesOrOptions.max_tokens ?? 1000
    if (typeof optionsOrRetries === 'number') {
      retries = optionsOrRetries
    }
  }

  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens
  }

  let lastError: Error | null = null
  
  // Use correct endpoint based on key type
  const apiEndpoint = apiKey.startsWith('sk-emergent') 
    ? 'https://api.emergent.ai/v1/chat/completions'  // Emergent Universal Key
    : 'https://api.openai.com/v1/chat/completions'   // OpenAI direct
  
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
