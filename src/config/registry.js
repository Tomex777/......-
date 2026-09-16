import { CONFIG_SCHEMA, inferUnknownEnv } from './schema.js';

const bool = (v, fallback = false) => v == null ? fallback : /^(1|true|yes|on)$/i.test(String(v));
const number = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const list = v => Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/).map(x => x.trim()).filter(Boolean);

export class ConfigRegistry {
  constructor({ env = process.env } = {}) {
    this.env = env;
    this.runtimeValues = new Map();
  }

  #parse(meta, value) {
    if (value == null || value === '') return meta.default;
    if (meta.type === 'boolean') return bool(value, meta.default);
    if (meta.type === 'number') return number(value, meta.default);
    if (meta.type === 'list' || meta.type === 'secret-list') return list(value);
    return value;
  }

  keys() {
    return [...new Set([
      ...Object.keys(CONFIG_SCHEMA),
      ...Object.keys(this.env),
      ...this.runtimeValues.keys()
    ])].sort();
  }

  metadata(key) { return CONFIG_SCHEMA[key] ?? inferUnknownEnv(key); }

  source(key) {
    if (this.runtimeValues.has(key)) return 'runtime';
    if (Object.prototype.hasOwnProperty.call(this.env, key)) return 'environment';
    return 'default';
  }

  effective(key) {
    const meta = this.metadata(key);
    if (this.runtimeValues.has(key)) return this.#parse(meta, this.runtimeValues.get(key));
    if (Object.prototype.hasOwnProperty.call(this.env, key)) return this.#parse(meta, this.env[key]);
    return meta.default;
  }

  get(key, fallback) {
    const value = this.effective(key);
    return value == null ? fallback : value;
  }

  setRuntime(key, value) {
    const meta = this.metadata(key);
    if (meta.apply !== 'hot') throw new Error(`${key} requires a deployment restart`);
    if (meta.type === 'secret' || meta.type === 'secret-list') throw new Error(`Secret ${key} must be changed through the host environment`);
    this.runtimeValues.set(key, value);
    return this.effective(key);
  }

  clearRuntime(key) { return this.runtimeValues.delete(key); }

  publicEntry(key) {
    const meta = this.metadata(key);
    const value = this.effective(key);
    const secret = meta.type === 'secret' || meta.type === 'secret-list';
    const configured = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
    return {
      key,
      group: meta.group,
      type: meta.type,
      required: Boolean(meta.required),
      discovered: Boolean(meta.discovered),
      apply: meta.apply ?? 'restart',
      source: this.source(key),
      configured,
      ...(secret ? { count: Array.isArray(value) ? value.length : configured ? 1 : 0 } : { value })
    };
  }

  publicSnapshot() { return this.keys().map(key => this.publicEntry(key)); }

  runtime() {
    return {
      port: this.get('PORT', 8787),
      ownerNumber: String(this.get('OWNER_NUMBER', '')).replace(/\D/g, ''),
      sessions: list(this.get('WHATSAPP_SESSIONS', ['main', 'assistant'])).map(x => x.toLowerCase()),
      roleMode: this.get('WHATSAPP_ROLE_MODE', 'split'),
      inboxSession: this.get('WHATSAPP_INBOX_SESSION', 'main'),
      aiSession: this.get('WHATSAPP_AI_SESSION', 'assistant'),
      fallbackEnabled: bool(this.get('WHATSAPP_FALLBACK_ENABLED', true), true),
      aiEnabled: bool(this.get('AI_ENABLED', true), true)
    };
  }
}
