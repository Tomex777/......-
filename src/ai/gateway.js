export class AIGateway {
  constructor({ config, providers = {} } = {}) {
    this.config = config;
    this.providers = new Map(Object.entries(providers));
  }

  register(name, provider) { this.providers.set(String(name).toLowerCase(), provider); }

  #isReady(name) {
    const provider = this.providers.get(name);
    if (!provider?.generate) return false;
    if (typeof provider.configured === 'function') return provider.configured();
    return true;
  }

  #fallback(except = []) {
    for (const [name, provider] of this.providers) {
      if (except.includes(name) || !provider?.generate) continue;
      if (typeof provider.configured === 'function' && !provider.configured()) continue;
      return name;
    }
    return null;
  }

  choose({ task = 'chat', complexity = 0.5, deterministic = false, provider: requestedProvider = null } = {}) {
    if (deterministic) return { provider: null, reason: 'deterministic' };
    if (!this.config.get('AI_ENABLED', true)) return { provider: null, reason: 'ai-disabled' };

    const requested = String(requestedProvider || '').trim().toLowerCase();
    if (requested) {
      if (this.#isReady(requested)) return { provider: requested, reason: 'request-route' };
      const fallback = this.#fallback([requested]);
      if (fallback) return { provider: fallback, reason: `fallback-from-${requested}` };
      return { provider: requested, reason: 'request-route-unavailable' };
    }

    const forced = String(this.config.get('AI_DEFAULT_ROUTE', 'auto') || 'auto').toLowerCase();
    if (forced !== 'auto') {
      if (this.#isReady(forced)) return { provider: forced, reason: 'forced-route' };
      const fallback = this.#fallback([forced]);
      if (fallback) return { provider: fallback, reason: `fallback-from-${forced}` };
      return { provider: forced, reason: 'forced-route-unavailable' };
    }

    let preferred = 'phi';
    if (task === 'transcribe' || task === 'speak' || task === 'vision') preferred = 'azure';
    else if (task === 'search') preferred = 'groq';
    else if (Number(complexity) >= 0.85) preferred = 'deepseek';
    else if (Number(complexity) <= 0.45) preferred = 'groq';

    if (this.#isReady(preferred)) return { provider: preferred, reason: 'capability-route' };
    const fallback = this.#fallback([preferred]);
    if (fallback) return { provider: fallback, reason: `fallback-from-${preferred}` };
    return { provider: preferred, reason: 'no-configured-provider' };
  }

  async generate(request = {}) {
    const choice = this.choose(request);
    if (!choice.provider) return { ...choice, skipped: true };
    const provider = this.providers.get(choice.provider);
    if (!provider?.generate) throw new Error(`Provider ${choice.provider} is not configured`);
    return { ...choice, result: await provider.generate(request) };
  }
}
