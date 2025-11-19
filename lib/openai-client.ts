/**
 * OpenAI Client - Direct SDK Usage
 * Verwendet offizielles OpenAI SDK statt custom fetch
 */

import OpenAI from 'openai'

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (client) return client
  
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment')
  }
  
  console.log(`[OpenAI] Initializing client with key: ${apiKey.substring(0, 20)}...`)
  
  client = new OpenAI({
    apiKey: apiKey,
  })
  
  return client
}

interface ChatCompletionOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
}

/**
 * Chat Completion mit OpenAI
 */
export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<string> {
  
  const client = getOpenAIClient()
  
  console.log(`[OpenAI] Sending request to model: ${options.model || 'gpt-4'}`)
  
  try {
    const response = await client.chat.completions.create({
      model: options.model || 'gpt-4',
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 1000,
    })
    
    const content = response.choices[0]?.message?.content || ''
    
    console.log(`[OpenAI] Success! Response length: ${content.length}`)
    
    return content
    
  } catch (error: any) {
    console.error('[OpenAI] Error:', error.message)
    throw error
  }
}
