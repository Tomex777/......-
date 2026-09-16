import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EventEmitter } from 'node:events';

function validateCommand(mod) {
  const command = mod.default ?? mod.command ?? mod;
  if (!command || typeof command !== 'object') throw new Error('Command module must export an object');
  if (!command.name || typeof command.name !== 'string') throw new Error('Command requires name');
  if (typeof command.execute !== 'function') throw new Error(`Command ${command.name} requires execute()`);
  return { aliases: [], ownerOnly: false, requiresAllowedChat: true, requiresAI: false, feature: null, ...command,
    name: command.name.toLowerCase(), aliases: (command.aliases ?? []).map(x => String(x).toLowerCase()) };
}

export class HotModuleRegistry extends EventEmitter {
  constructor({ commandDir = path.resolve('commands'), utilDir = path.resolve('utils') } = {}) {
    super(); this.commandDir = commandDir; this.utilDir = utilDir; this.commands = new Map(); this.aliases = new Map();
    this.utils = new Map(); this.errors = new Map(); this.watchers = [];
  }
  async loadAll() { await this.#loadDirectory(this.commandDir, 'command'); await this.#loadDirectory(this.utilDir, 'util'); return this; }
  async #loadDirectory(dir, kind) { fs.mkdirSync(dir, { recursive: true }); const files = fs.readdirSync(dir).filter(f => /\.(mjs|js)$/.test(f)); for (const file of files) await this.reloadFile(path.join(dir, file), kind); }
  async reloadFile(file, kind) {
    const abs = path.resolve(file); const key = `${kind}:${abs}`;
    try {
      const href = `${pathToFileURL(abs).href}?nightReload=${Date.now()}-${Math.random()}`; const mod = await import(href);
      if (kind === 'command') {
        const cmd = validateCommand(mod);
        for (const [alias, target] of [...this.aliases]) if (target === cmd.name) this.aliases.delete(alias);
        this.commands.set(cmd.name, { ...cmd, __file: abs, __loadedAt: Date.now() });
        for (const alias of cmd.aliases) this.aliases.set(alias, cmd.name);
      } else {
        const value = mod.default ?? mod; this.utils.set(path.basename(abs).replace(/\.(mjs|js)$/, ''), { value, __file: abs, __loadedAt: Date.now() });
      }
      this.errors.delete(key); this.emit('loaded', { kind, file: abs }); return true;
    } catch (error) { this.errors.set(key, { message: error.message, at: Date.now() }); this.emit('load-error', { kind, file: abs, error }); return false; }
  }
  resolveCommand(name) { const n = String(name).toLowerCase(); return this.commands.get(n) ?? this.commands.get(this.aliases.get(n)) ?? null; }
  startWatching() {
    const install = (dir, kind) => { fs.mkdirSync(dir, { recursive: true }); let timer; const watcher = fs.watch(dir, () => { clearTimeout(timer); timer = setTimeout(() => this.#loadDirectory(dir, kind).catch(err => this.emit('watch-error', err)), 100); }); this.watchers.push(watcher); };
    install(this.commandDir, 'command'); install(this.utilDir, 'util');
  }
  stopWatching() { for (const w of this.watchers.splice(0)) w.close(); }
  snapshot() { return [...this.commands.values()].map(c => ({ name: c.name, aliases: c.aliases, ownerOnly: c.ownerOnly, requiresAllowedChat: c.requiresAllowedChat, requiresAI: c.requiresAI, feature: c.feature, file: c.__file, loadedAt: c.__loadedAt })); }
}
