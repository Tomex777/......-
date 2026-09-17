import test from 'node:test';
import assert from 'node:assert/strict';
import { GroqProvider } from '../src/ai/providers/groq.js';
import { AIGateway } from '../src/ai/gateway.js';
import { NightAIService } from '../src/ai/service.js';

class Config {
  constructor(values = {}) { this.values = { AI_ENABLED: true, AI_DEFAULT_ROUTE: 'auto', GROQ_MODEL: 'openai/gpt-oss-120b', GROQ_SEARCH_MODEL: 'groq/compound-mini', GROQ_MAX_TOKENS: 1800, ...values }; }
  get(key, fallback) { return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : fallback; }
}

function mockFetch({ text = 'Hello from Groq', model = 'openai/gpt-oss-120b' } = {}) {
  return async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.method, 'POST');
    assert.match(options.headers.authorization, /^Bearer /);
    const body = JSON.parse(options.body);
    assert.ok(Array.isArray(body.messages));
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ choices: [{ message: { content: text }, finish_reason: 'stop' }], model, usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 } });
      }
    };
  };
}

test('GroqProvider calls the OpenAI-compatible Groq endpoint', async () => {
  const provider = new GroqProvider({ config: new Config({ GROQ_API_KEY: 'test-key' }), fetchImpl: mockFetch() });
  const result = await provider.generate({ prompt: 'hello' });
  assert.equal(result.text, 'Hello from Groq');
  assert.equal(result.model, 'openai/gpt-oss-120b');
  assert.equal(result.usage.total_tokens, 9);
});

test('AIGateway routes low-latency chat to configured Groq', async () => {
  const config = new Config({ GROQ_API_KEY: 'test-key' });
  const provider = new GroqProvider({ config, fetchImpl: mockFetch() });
  const gateway = new AIGateway({ config, providers: { groq: provider } });
  const choice = gateway.choose({ task: 'chat', complexity: 0.3 });
  assert.equal(choice.provider, 'groq');
  const result = await gateway.generate({ prompt: 'hi', task: 'chat', complexity: 0.3 });
  assert.equal(result.result.text, 'Hello from Groq');
});

test('NightAIService can chat through Groq and keep short context', async () => {
  const config = new Config({ GROQ_API_KEY: 'test-key', AI_DEFAULT_ROUTE: 'groq' });
  const provider = new GroqProvider({ config, fetchImpl: mockFetch({ text: 'Night online' }) });
  const gateway = new AIGateway({ config, providers: { groq: provider } });
  const service = new NightAIService({ config, gateway });
  const result = await service.ask({ text: 'Are you there?', sessionId: 'assistant', chatJid: 'owner@s.whatsapp.net' });
  assert.equal(result.text, 'Night online');
  assert.equal(result.provider, 'groq');
});
