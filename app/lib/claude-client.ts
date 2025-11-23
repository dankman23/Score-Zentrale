/**
 * Claude Sonnet 4 Client mit Emergent LLM Key (Universal Key)
 * Verwendet Emergent Integrations Endpoint
 */

import OpenAI from 'openai'

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeResponse {
  id: string
  model: string
  role: string
  content: Array<{ type: string; text: string }>
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export class ClaudeClient {
  private client: OpenAI
  private model: string = 'anthropic/claude-3-7-sonnet-20250219' // Claude 3.7 Sonnet

  constructor() {
    const apiKey = process.env.EMERGENT_LLM_KEY || ''
    if (!apiKey) {
      throw new Error('EMERGENT_LLM_KEY nicht gefunden')
    }

    // Emergent Universal Key über Emergent Integrations Endpoint
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://integrations.emergentagent.com/llm' // Emergent Integrations Endpoint
    })
  }

  async createMessage(
    messages: ClaudeMessage[],
    systemPrompt: string,
    maxTokens: number = 2000
  ): Promise<ClaudeResponse> {
    try {
      // Konvertiere zu OpenAI-Format (kompatibel mit Emergent Endpoint)
      const openaiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ]

      const response = await this.client.chat.completions.create({
        model: this.model, // anthropic/claude-3-7-sonnet-20250219
        messages: openaiMessages,
        max_tokens: maxTokens,
        temperature: 0.7
      })

      // Konvertiere Antwort zu Claude-Format für Kompatibilität
      const content = response.choices[0]?.message?.content || ''
      
      return {
        id: response.id,
        model: response.model,
        role: 'assistant',
        content: [{ type: 'text', text: content }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0
        }
      }
    } catch (error: any) {
      console.error('[Claude Client] Error:', error)
      throw error
    }
  }

  /**
   * Schätzt die Kosten für eine Batch-Verarbeitung
   * Basierend auf Claude Sonnet 4 Pricing (Stand Nov 2024):
   * - Input: $3 pro 1M Tokens
   * - Output: $15 pro 1M Tokens
   */
  estimateCosts(articleCount: number, avgInputTokens: number = 1500, avgOutputTokens: number = 500): {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    inputCostUSD: number
    outputCostUSD: number
    totalCostUSD: number
    totalCostEUR: number
  } {
    const inputTokens = articleCount * avgInputTokens
    const outputTokens = articleCount * avgOutputTokens
    const totalTokens = inputTokens + outputTokens

    // Claude Sonnet 4 Pricing
    const inputCostPer1M = 3.0  // $3 per 1M input tokens
    const outputCostPer1M = 15.0 // $15 per 1M output tokens

    const inputCostUSD = (inputTokens / 1_000_000) * inputCostPer1M
    const outputCostUSD = (outputTokens / 1_000_000) * outputCostPer1M
    const totalCostUSD = inputCostUSD + outputCostUSD

    // Umrechnung USD -> EUR (ca. 0.92)
    const totalCostEUR = totalCostUSD * 0.92

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      inputCostUSD,
      outputCostUSD,
      totalCostUSD,
      totalCostEUR
    }
  }
}
