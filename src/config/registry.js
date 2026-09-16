import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_SCHEMA, inferUnknownEnv } from './schema.js';

const bool = (v, fallback = false) => v == null ? fallback : /^(1|true|yes|on)$/i.test(String(v));
const number = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const list = v => Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/).map(x => x.trim()).filter(Boolean);

export class ConfigRegistry {
  constructor({ env = process.env, overridesPath = path.resolve('data/runtime-settings.json') } = {}) {
    this.env = env; this.overridesPath = overridesPath; this.overrides = this.#readOverrides();
  }
  #readOverrides() { try { return JSON.parse(fs.readFileSync(this.overridesPath, 'utf8')); } catch { return {}; } }
  #parse(meta, value) {
    if (value == null || value === '') return meta.default;
    if (meta.type === 'boolean') return bool(value, meta.default);
    if (meta.type === 'number') return number(value, meta.default);
    if (meta.type === 'list' || meta.type === 'secret-list') return list(value);
    return value;
  }
  keys() { return [...new Set([...Object.keys(CONFIG_SCHEMA), ...Object.keys(this.env), ...Object.keys(this.overrides)])].sort(); }
  metadata(key) { return CONFIG_SCHEMA[key] ?? inferUnknownEnv(key); }
  effective(key) {
    const meta = this.metadata(key);
    if (Object.prototype.hasOwnProperty.call(this.overrides, key)) return this.#parse(meta, this.overrides[key]);
    if (Object.prototype.hasOwnProperty.call(this.env, key)) return this.#parse(meta, this.env[key]);
    return meta.default;
  }
  get(key, fallback) { const v = this.effective(key); return v == null ? fallback : v; }
  setOverride(key, value) {
    const meta = this.metadata(key);
    if (meta.type === 'secret' || meta.type === 'secret-list') throw new Error(`Secret ${key} must be replaced through the secret store`);
    this.overrides[key] = value;
    fs.mkdirSync(path.dirname(this.overridesPath), { recursive: true });
    const tmp = `${this.overridesPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.overrides, null, 2)); fs.renameSync(tmp, this.overridesPath);
  }
  publicEntry(key) {
    const meta = this.metadata(key); const value = this.effective(key);
    const secret = meta.type === 'secret' || meta.type === 'secret-list';
    const configured = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
    return { key, group: meta.group, type: meta.type, required: Boolean(meta.required), discovered: Boolean(meta.discovered), configured,
      ...(secret ? { count: Array.isArray(value) ? value.length : configured ? 1 : 0 } : { value }) };
  }
  publicSnapshot() { return this.keys().map(key => this.publicEntry(key)); }
  runtime() {
    return {
      port: this.get('PORT', 8787), ownerNumber: String(this.get('OWNER_NUMBER', '')).replace(/\D/g, ''),
      sessions: list(this.get('WHATSAPP_SESSIONS', ['main', 'assistant'])).map(x => x.toLowerCase()),
      roleMode: this.get('WHATSAPP_ROLE_MODE', 'split'), inboxSession: this.get('WHATSAPP_INBOX_SESSION', 'main'),
      aiSession: this.get('WHATSAPP_AI_SESSION', 'assistant'), fallbackEnabled: bool(this.get('WHATSAPP_FALLBACK_ENABLED', true), true),
      aiEnabled: bool(this.get('AI_ENABLED', true), true)
    };
  }
}
