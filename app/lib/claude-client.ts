/**
 * Claude Sonnet 4 Client mit Emergent LLM Key (Universal Key)
 * Verwendet Emergent Integrations Endpoint direkt via fetch()
 */

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
  private apiKey: string
  private model: string = 'claude-sonnet-4-20250514' // Claude Sonnet 4
  private endpoint: string = 'https://integrations.emergentagent.com/llm/v1/chat/completions'

  constructor() {
    this.apiKey = process.env.EMERGENT_LLM_KEY || ''
    if (!this.apiKey) {
      throw new Error('EMERGENT_LLM_KEY nicht gefunden')
    }
  }

  async createMessage(
    messages: ClaudeMessage[],
    systemPrompt: string,
    maxTokens: number = 2000
  ): Promise<ClaudeResponse> {
    try {
      // Konvertiere zu OpenAI-Format (kompatibel mit Emergent Endpoint)
      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ]

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: openaiMessages,
          max_tokens: maxTokens,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Claude Client] HTTP Error:', response.status, errorText)
        throw new Error(`Claude API Error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Konvertiere OpenAI-Response zu Claude-Format für Kompatibilität
      const content = data.choices[0]?.message?.content || ''
      
      return {
        id: data.id,
        model: data.model,
        role: 'assistant',
        content: [{ type: 'text', text: content }],
        stop_reason: data.choices[0]?.finish_reason || 'end_turn',
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0
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
