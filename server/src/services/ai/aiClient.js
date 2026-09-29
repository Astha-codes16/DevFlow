/**
 * AI Client abstraction supporting external LLMs (Gemini, OpenAI, Groq, etc.)
 * with resilient fallback heuristics if no key is configured or API limits occur.
 */

export class AIClient {
  constructor() {
    this.apiKey = process.env.AI_API_KEY || '';
    this.model = process.env.AI_MODEL || 'gemini-1.5-flash';
    this.baseUrl = process.env.AI_BASE_URL || '';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Universal completion method that requests JSON or structured markdown
   */
  async complete({ systemPrompt, userPrompt, responseFormat = 'json' }) {
    if (!this.isConfigured()) {
      return null; // Signals the caller to use deterministic engineering analysis
    }

    try {
      // Determine endpoint: Gemini or standard OpenAI-compatible API
      if (this.baseUrl || this.apiKey.startsWith('sk-')) {
        return await this._callOpenAICompatible({ systemPrompt, userPrompt, responseFormat });
      } else {
        return await this._callGeminiAPI({ systemPrompt, userPrompt, responseFormat });
      }
    } catch (err) {
      console.warn(`[AIClient] Live LLM call failed (${err.message}). Falling back to internal engine.`);
      return null;
    }
  }

  async _callOpenAICompatible({ systemPrompt, userPrompt, responseFormat }) {
    const url = (this.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions';
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const body = {
      model: this.model || 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI API responded with status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async _callGeminiAPI({ systemPrompt, userPrompt, responseFormat }) {
    const model = this.model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nUser Request:\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        ...(responseFormat === 'json' ? { responseMimeType: 'application/json' } : {})
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

export const aiClient = new AIClient();
