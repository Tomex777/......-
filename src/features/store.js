import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const now = () => Date.now();
const clamp = (value, min, max, fallback) => Math.max(min, Math.min(Number(value) || fallback, max));
const safeParse = value => { try { return JSON.parse(value); } catch { return null; } };

export class FeatureStore {
  constructor(dbPath = path.resolve('data/night.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS library_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        archived_at INTEGER,
        kind TEXT NOT NULL,
        title TEXT,
        text_value TEXT,
        file_path TEXT,
        mime_type TEXT,
        source_url TEXT,
        session_id TEXT,
        chat_jid TEXT,
        message_id TEXT,
        metadata_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_library_created ON library_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_library_archived ON library_items(archived_at,created_at DESC);

      CREATE TABLE IF NOT EXISTS private_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        text_value TEXT NOT NULL,
        tags TEXT,
        archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        text_value TEXT NOT NULL,
        due_at INTEGER,
        done INTEGER NOT NULL DEFAULT 0,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_todos_open ON todos(done,due_at,created_at);

      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        due_at INTEGER NOT NULL,
        recurrence_ms INTEGER,
        text_value TEXT NOT NULL,
        session_id TEXT NOT NULL,
        chat_jid TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        last_fired_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(active,due_at);

      CREATE TABLE IF NOT EXISTS watches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        kind TEXT NOT NULL,
        query_value TEXT,
        url TEXT,
        session_id TEXT NOT NULL,
        chat_jid TEXT NOT NULL,
        interval_ms INTEGER NOT NULL DEFAULT 3600000,
        next_check_at INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        state_json TEXT,
        last_checked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_watches_due ON watches(active,next_check_at);

      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL UNIQUE COLLATE NOCASE,
        value_text TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_labels (
        jid TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  saveItem(item = {}) {
    const createdAt = Number(item.createdAt || now());
    const result = this.db.prepare(`INSERT INTO library_items(created_at,kind,title,text_value,file_path,mime_type,source_url,session_id,chat_jid,message_id,metadata_json)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
        createdAt,
        String(item.kind || (item.filePath ? 'file' : item.sourceUrl ? 'link' : 'text')),
        item.title ?? null,
        item.text ?? null,
        item.filePath ?? null,
        item.mimeType ?? null,
        item.sourceUrl ?? null,
        item.sessionId ?? null,
        item.chatJid ?? null,
        item.messageId ?? null,
        item.metadata ? JSON.stringify(item.metadata) : null
      );
    return Number(result.lastInsertRowid);
  }

  recentItems(limit = 25, { includeArchived = false } = {}) {
    const n = clamp(limit, 1, 500, 25);
    const sql = includeArchived
      ? 'SELECT * FROM library_items ORDER BY created_at DESC,id DESC LIMIT ?'
      : 'SELECT * FROM library_items WHERE archived_at IS NULL ORDER BY created_at DESC,id DESC LIMIT ?';
    return this.db.prepare(sql).all(n).map(this.#libraryRow);
  }

  findItems(query, limit = 25) {
    const q = `%${String(query || '').trim()}%`;
    if (q === '%%') return this.recentItems(limit);
    const n = clamp(limit, 1, 200, 25);
    return this.db.prepare(`SELECT * FROM library_items
      WHERE archived_at IS NULL AND (
        COALESCE(title,'') LIKE ? COLLATE NOCASE OR
        COALESCE(text_value,'') LIKE ? COLLATE NOCASE OR
        COALESCE(source_url,'') LIKE ? COLLATE NOCASE OR
        COALESCE(file_path,'') LIKE ? COLLATE NOCASE
      ) ORDER BY created_at DESC,id DESC LIMIT ?`).all(q,q,q,q,n).map(this.#libraryRow);
  }

  archiveItem(id) {
    const result = this.db.prepare('UPDATE library_items SET archived_at=? WHERE id=? AND archived_at IS NULL').run(now(), Number(id));
    return Number(result.changes) > 0;
  }

  deleteItem(id) {
    const row = this.db.prepare('SELECT file_path FROM library_items WHERE id=?').get(Number(id));
    const result = this.db.prepare('DELETE FROM library_items WHERE id=?').run(Number(id));
    if (row?.file_path) { try { fs.rmSync(row.file_path, { force: true }); } catch {} }
    return Number(result.changes) > 0;
  }

  storageStats() {
    const counts = this.db.prepare(`SELECT kind,COUNT(*) AS count FROM library_items WHERE archived_at IS NULL GROUP BY kind ORDER BY count DESC`).all();
    const total = this.db.prepare('SELECT COUNT(*) AS n FROM library_items WHERE archived_at IS NULL').get()?.n ?? 0;
    let bytes = 0;
    for (const row of this.db.prepare('SELECT file_path FROM library_items WHERE archived_at IS NULL AND file_path IS NOT NULL').all()) {
      try { bytes += fs.statSync(row.file_path).size; } catch {}
    }
    return { total, bytes, counts };
  }

  #libraryRow(row) {
    return {
      id: Number(row.id), createdAt: Number(row.created_at), archivedAt: row.archived_at == null ? null : Number(row.archived_at),
      kind: row.kind, title: row.title, text: row.text_value, filePath: row.file_path, mimeType: row.mime_type,
      sourceUrl: row.source_url, sessionId: row.session_id, chatJid: row.chat_jid, messageId: row.message_id,
      metadata: row.metadata_json ? safeParse(row.metadata_json) : null
    };
  }

  addNote(text, tags = null) {
    const result = this.db.prepare('INSERT INTO private_notes(created_at,text_value,tags) VALUES(?,?,?)').run(now(), String(text), tags ? String(tags) : null);
    return Number(result.lastInsertRowid);
  }
  listNotes(limit = 25) { return this.db.prepare('SELECT * FROM private_notes WHERE archived=0 ORDER BY created_at DESC,id DESC LIMIT ?').all(clamp(limit,1,200,25)); }

  addTodo(text, dueAt = null) {
    const result = this.db.prepare('INSERT INTO todos(created_at,text_value,due_at) VALUES(?,?,?)').run(now(), String(text), dueAt == null ? null : Number(dueAt));
    return Number(result.lastInsertRowid);
  }
  listTodos({ includeDone = false, limit = 50 } = {}) {
    const n = clamp(limit, 1, 500, 50);
    return includeDone
      ? this.db.prepare('SELECT * FROM todos ORDER BY done ASC,COALESCE(due_at,9223372036854775807),created_at DESC LIMIT ?').all(n)
      : this.db.prepare('SELECT * FROM todos WHERE done=0 ORDER BY COALESCE(due_at,9223372036854775807),created_at DESC LIMIT ?').all(n);
  }
  completeTodo(id) { return Number(this.db.prepare('UPDATE todos SET done=1,completed_at=? WHERE id=? AND done=0').run(now(), Number(id)).changes) > 0; }
  deleteTodo(id) { return Number(this.db.prepare('DELETE FROM todos WHERE id=?').run(Number(id)).changes) > 0; }

  addReminder({ dueAt, text, sessionId, chatJid, recurrenceMs = null }) {
    const result = this.db.prepare(`INSERT INTO reminders(created_at,due_at,recurrence_ms,text_value,session_id,chat_jid)
      VALUES(?,?,?,?,?,?)`).run(now(), Number(dueAt), recurrenceMs == null ? null : Number(recurrenceMs), String(text), String(sessionId), String(chatJid));
    return Number(result.lastInsertRowid);
  }
  listReminders(limit = 50) { return this.db.prepare('SELECT * FROM reminders WHERE active=1 ORDER BY due_at ASC LIMIT ?').all(clamp(limit,1,500,50)); }
  dueReminders(at = now(), limit = 50) { return this.db.prepare('SELECT * FROM reminders WHERE active=1 AND due_at<=? ORDER BY due_at ASC LIMIT ?').all(Number(at), clamp(limit,1,200,50)); }
  markReminderFired(id, firedAt = now()) {
    const row = this.db.prepare('SELECT recurrence_ms,due_at FROM reminders WHERE id=?').get(Number(id));
    if (!row) return false;
    if (row.recurrence_ms && Number(row.recurrence_ms) > 0) {
      let next = Number(row.due_at) + Number(row.recurrence_ms);
      while (next <= firedAt) next += Number(row.recurrence_ms);
      this.db.prepare('UPDATE reminders SET due_at=?,last_fired_at=? WHERE id=?').run(next, Number(firedAt), Number(id));
    } else {
      this.db.prepare('UPDATE reminders SET active=0,last_fired_at=? WHERE id=?').run(Number(firedAt), Number(id));
    }
    return true;
  }
  deleteReminder(id) { return Number(this.db.prepare('DELETE FROM reminders WHERE id=?').run(Number(id)).changes) > 0; }

  addWatch({ kind, query = null, url = null, sessionId, chatJid, intervalMs = 3600000, state = null }) {
    const interval = clamp(intervalMs, 3600000, 30 * 86400000, 3600000);
    const result = this.db.prepare(`INSERT INTO watches(created_at,kind,query_value,url,session_id,chat_jid,interval_ms,next_check_at,state_json)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(now(), String(kind), query == null ? null : String(query), url == null ? null : String(url), String(sessionId), String(chatJid), interval, now() + interval, state ? JSON.stringify(state) : null);
    return Number(result.lastInsertRowid);
  }
  listWatches(limit = 50) { return this.db.prepare('SELECT * FROM watches WHERE active=1 ORDER BY next_check_at ASC LIMIT ?').all(clamp(limit,1,500,50)).map(this.#watchRow); }
  dueWatches(at = now(), limit = 20) { return this.db.prepare('SELECT * FROM watches WHERE active=1 AND next_check_at<=? ORDER BY next_check_at ASC LIMIT ?').all(Number(at), clamp(limit,1,100,20)).map(this.#watchRow); }
  updateWatch(id, { state = null, checkedAt = now(), nextCheckAt = null, active = true } = {}) {
    const row = this.db.prepare('SELECT interval_ms FROM watches WHERE id=?').get(Number(id));
    if (!row) return false;
    const next = Number(nextCheckAt ?? (Number(checkedAt) + Number(row.interval_ms)));
    this.db.prepare('UPDATE watches SET state_json=?,last_checked_at=?,next_check_at=?,active=? WHERE id=?')
      .run(state == null ? null : JSON.stringify(state), Number(checkedAt), next, active ? 1 : 0, Number(id));
    return true;
  }
  deleteWatch(id) { return Number(this.db.prepare('DELETE FROM watches WHERE id=?').run(Number(id)).changes) > 0; }
  #watchRow(row) { return { ...row, id: Number(row.id), state: row.state_json ? safeParse(row.state_json) : null }; }

  remember(subject, value) {
    const t = now();
    this.db.prepare(`INSERT INTO memories(subject,value_text,created_at,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(subject) DO UPDATE SET value_text=excluded.value_text,updated_at=excluded.updated_at`).run(String(subject).trim(), String(value).trim(), t, t);
    return true;
  }
  forget(subject) { return Number(this.db.prepare('DELETE FROM memories WHERE subject=? COLLATE NOCASE').run(String(subject).trim()).changes) > 0; }
  memories(query = '', limit = 50) {
    const n = clamp(limit,1,500,50);
    const q = String(query || '').trim();
    if (!q) return this.db.prepare('SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?').all(n);
    const like = `%${q}%`;
    return this.db.prepare('SELECT * FROM memories WHERE subject LIKE ? COLLATE NOCASE OR value_text LIKE ? COLLATE NOCASE ORDER BY updated_at DESC LIMIT ?').all(like,like,n);
  }

  setChatLabel(jid, label) {
    this.db.prepare(`INSERT INTO chat_labels(jid,label,updated_at) VALUES(?,?,?) ON CONFLICT(jid) DO UPDATE SET label=excluded.label,updated_at=excluded.updated_at`)
      .run(String(jid), String(label), now());
  }
  getChatLabel(jid) { return this.db.prepare('SELECT label FROM chat_labels WHERE jid=?').get(String(jid))?.label ?? null; }

  close() { try { this.db.close(); } catch {} }
}
