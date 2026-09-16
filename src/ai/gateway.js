export class AIGateway {
  constructor({ config, providers = {} } = {}) { this.config = config; this.providers = new Map(Object.entries(providers)); }
  register(name, provider) { this.providers.set(name, provider); }
  choose({ task = 'chat', complexity = 0.5, deterministic = false } = {}) {
    if (deterministic) return { provider: null, reason: 'deterministic' };
    if (!this.config.get('AI_ENABLED', true)) return { provider: null, reason: 'ai-disabled' };
    const forced = this.config.get('AI_DEFAULT_ROUTE', 'auto'); if (forced !== 'auto') return { provider: forced, reason: 'forced-route' };
    if (task === 'transcribe' || task === 'speak' || task === 'vision') return { provider: 'azure', reason: 'capability-route' };
    if (complexity >= 0.85) return { provider: 'deepseek', reason: 'high-complexity' };
    if (complexity <= 0.45) return { provider: 'groq', reason: 'economy-first' };
    return { provider: 'phi', reason: 'default-reasoning' };
  }
  async generate(request) { const choice = this.choose(request); if (!choice.provider) return { ...choice, skipped: true }; const provider = this.providers.get(choice.provider); if (!provider?.generate) throw new Error(`Provider ${choice.provider} is not configured`); return { ...choice, result: await provider.generate(request) }; }
}
