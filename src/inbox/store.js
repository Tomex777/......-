import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class InboxStore {
  constructor(dbPath = path.resolve('data/night.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true }); this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS chats (session_id TEXT NOT NULL,jid TEXT NOT NULL,name TEXT,last_message_at INTEGER NOT NULL DEFAULT 0,unread_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(session_id,jid));
      CREATE TABLE IF NOT EXISTS messages (session_id TEXT NOT NULL,id TEXT NOT NULL,chat_jid TEXT NOT NULL,participant_jid TEXT,from_me INTEGER NOT NULL,timestamp INTEGER NOT NULL,type TEXT NOT NULL,view_once INTEGER NOT NULL DEFAULT 0,text TEXT,payload_json TEXT NOT NULL,PRIMARY KEY(session_id,id));
      CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(session_id,chat_jid,timestamp DESC);`);
  }
  upsertMessage(msg) {
    if (!msg?.id || !msg?.chatJid) return false;
    this.db.prepare(`INSERT INTO messages(session_id,id,chat_jid,participant_jid,from_me,timestamp,type,view_once,text,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id,id) DO UPDATE SET payload_json=excluded.payload_json,text=excluded.text,type=excluded.type,view_once=excluded.view_once`)
      .run(msg.sessionId,msg.id,msg.chatJid,msg.participantJid,msg.fromMe?1:0,msg.timestamp,msg.type,msg.viewOnce?1:0,msg.text,JSON.stringify(msg));
    this.db.prepare(`INSERT INTO chats(session_id,jid,last_message_at,unread_count) VALUES(?,?,?,?) ON CONFLICT(session_id,jid) DO UPDATE SET last_message_at=MAX(last_message_at,excluded.last_message_at),unread_count=unread_count+excluded.unread_count`)
      .run(msg.sessionId,msg.chatJid,msg.timestamp,msg.fromMe?0:1); return true;
  }
  listChats(sessionId, limit = 100) { return this.db.prepare('SELECT * FROM chats WHERE session_id=? ORDER BY last_message_at DESC LIMIT ?').all(sessionId, limit); }
  listMessages(sessionId, chatJid, limit = 100, before = Number.MAX_SAFE_INTEGER) {
    const rows = this.db.prepare('SELECT payload_json FROM messages WHERE session_id=? AND chat_jid=? AND timestamp<? ORDER BY timestamp DESC LIMIT ?').all(sessionId,chatJid,before,limit);
    return rows.map(r => JSON.parse(r.payload_json)).reverse();
  }
}
