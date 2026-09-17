import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const clamp = (value, min, max, fallback) => Math.max(min, Math.min(Number(value) || fallback, max));

export class ActivityStore {
  constructor(dbPath = path.resolve('data/night.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS activity_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at INTEGER NOT NULL,
        kind TEXT NOT NULL,
        session_id TEXT,
        chat_jid TEXT,
        sender_jid TEXT,
        name TEXT,
        input_text TEXT,
        output_text TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        duration_ms INTEGER,
        provider TEXT,
        model TEXT,
        metadata_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_activity_at ON activity_events(at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_kind_at ON activity_events(kind,at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_name_at ON activity_events(name,at DESC);`);
  }

  append(event = {}) {
    this.db.prepare(`INSERT INTO activity_events(at,kind,session_id,chat_jid,sender_jid,name,input_text,output_text,success,duration_ms,provider,model,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        Number(event.at || Date.now()),
        String(event.kind || 'event'),
        event.sessionId ?? null,
        event.chatJid ?? null,
        event.senderJid ?? null,
        event.name ?? null,
        event.input ?? null,
        event.output ?? null,
        event.success === false ? 0 : 1,
        Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : null,
        event.provider ?? null,
        event.model ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null
      );
  }

  logCommand(event = {}) { this.append({ ...event, kind: 'command' }); }
  logAI(event = {}) { this.append({ ...event, kind: 'ai' }); }

  recent({ kind = null, limit = 25 } = {}) {
    const safeLimit = clamp(limit, 1, 5000, 25);
    const rows = kind
      ? this.db.prepare('SELECT * FROM activity_events WHERE kind=? ORDER BY at DESC,id DESC LIMIT ?').all(kind, safeLimit)
      : this.db.prepare('SELECT * FROM activity_events ORDER BY at DESC,id DESC LIMIT ?').all(safeLimit);
    return rows.map(row => ({
      ...row,
      success: Boolean(row.success),
      metadata: row.metadata_json ? safeParse(row.metadata_json) : null
    }));
  }

  all({ kind = null, limit = 10000 } = {}) { return this.recent({ kind, limit }); }

  usage() {
    const total = this.db.prepare('SELECT COUNT(*) AS n FROM activity_events').get()?.n ?? 0;
    const commands = this.db.prepare("SELECT COUNT(*) AS n FROM activity_events WHERE kind='command'").get()?.n ?? 0;
    const ai = this.db.prepare("SELECT COUNT(*) AS n FROM activity_events WHERE kind='ai'").get()?.n ?? 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = this.db.prepare('SELECT COUNT(*) AS n FROM activity_events WHERE at>=?').get(todayStart.getTime())?.n ?? 0;
    const topCommands = this.db.prepare(`SELECT name,COUNT(*) AS count FROM activity_events
      WHERE kind='command' AND name IS NOT NULL GROUP BY name ORDER BY count DESC,name ASC LIMIT 10`).all();
    const providers = this.db.prepare(`SELECT provider,COUNT(*) AS count FROM activity_events
      WHERE kind='ai' AND provider IS NOT NULL GROUP BY provider ORDER BY count DESC`).all();
    return { total, commands, ai, today, topCommands, providers };
  }

  close() { try { this.db.close(); } catch {} }
}

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}
