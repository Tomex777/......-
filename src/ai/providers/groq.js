const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function normalizeKeys(value) {
  if (Array.isArray(value)) return value.map(String).map(x => x.trim()).filter(Boolean);
  return String(value ?? '').split(/[\n,]/).map(x => x.trim()).filter(Boolean);
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export class GroqProvider {
  constructor({ config, fetchImpl = globalThis.fetch } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.keyCursor = 0;
  }

  keys() {
    const many = normalizeKeys(this.config?.get?.('GROQ_API_KEYS', []));
    const single = String(this.config?.get?.('GROQ_API_KEY', '') ?? '').trim();
    return [...new Set([...many, ...(single ? [single] : [])])];
  }

  configured() { return this.keys().length > 0; }

  modelFor(task = 'chat', explicit = null) {
    if (explicit) return explicit;
    if (task === 'search') return this.config?.get?.('GROQ_SEARCH_MODEL', 'groq/compound-mini') || 'groq/compound-mini';
    return this.config?.get?.('GROQ_MODEL', 'openai/gpt-oss-120b') || 'openai/gpt-oss-120b';
  }

  async generate({ messages, prompt, system, task = 'chat', model = null, temperature = 0.35, maxTokens = null } = {}) {
    const keys = this.keys();
    if (!keys.length) throw new Error('Groq is not configured. Set GROQ_API_KEYS in .env.');
    if (typeof this.fetchImpl !== 'function') throw new Error('fetch() is unavailable in this Node runtime');

    const finalMessages = Array.isArray(messages) && messages.length
      ? messages
      : [
          ...(system ? [{ role: 'system', content: String(system) }] : []),
          { role: 'user', content: String(prompt ?? '') }
        ];

    const targetModel = this.modelFor(task, model);
    const body = {
      model: targetModel,
      messages: finalMessages,
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.35,
      max_completion_tokens: Math.max(64, Math.min(Number(maxTokens ?? this.config?.get?.('GROQ_MAX_TOKENS', 1800)) || 1800, 8192))
    };

    let lastError = null;
    for (let attempt = 0; attempt < keys.length; attempt += 1) {
      const keyIndex = (this.keyCursor + attempt) % keys.length;
      const key = keys[keyIndex];
      try {
        const response = await this.fetchImpl(GROQ_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${key}`
          },
          body: JSON.stringify(body)
        });
        const rawText = await response.text();
        const data = safeJson(rawText);
        if (!response.ok) {
          const detail = data?.error?.message || data?.message || rawText.slice(0, 500) || `HTTP ${response.status}`;
          const error = new Error(`Groq ${response.status}: ${detail}`);
          error.status = response.status;
          lastError = error;
          if ([401, 403, 429, 498].includes(response.status) && keys.length > 1) continue;
          throw error;
        }

        const message = data?.choices?.[0]?.message;
        const text = String(message?.content ?? '').trim();
        if (!text) throw new Error('Groq returned an empty response');
        this.keyCursor = (keyIndex + 1) % keys.length;
        return {
          text,
          model: data?.model || targetModel,
          usage: data?.usage ?? null,
          usageBreakdown: data?.usage_breakdown ?? null,
          executedTools: message?.executed_tools ?? null,
          finishReason: data?.choices?.[0]?.finish_reason ?? null
        };
      } catch (error) {
        lastError = error;
        if (attempt >= keys.length - 1) break;
      }
    }
    throw lastError || new Error('Groq request failed');
  }
}
