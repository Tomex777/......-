import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export class InboxStore {
  constructor(dbPath = path.resolve('data/night.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 }); this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS chats (session_id TEXT NOT NULL,jid TEXT NOT NULL,name TEXT,last_message_at INTEGER NOT NULL DEFAULT 0,unread_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(session_id,jid));
      CREATE TABLE IF NOT EXISTS messages (session_id TEXT NOT NULL,id TEXT NOT NULL,chat_jid TEXT NOT NULL,participant_jid TEXT,from_me INTEGER NOT NULL,timestamp INTEGER NOT NULL,type TEXT NOT NULL,view_once INTEGER NOT NULL DEFAULT 0,text TEXT,payload_json TEXT NOT NULL,PRIMARY KEY(session_id,id));
      CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(session_id,chat_jid,timestamp DESC);`);
  }
  upsertMessage(msg) {
    if (!msg?.id || !msg?.chatJid) return false;
    const exists = this.db.prepare('SELECT 1 FROM messages WHERE session_id=? AND id=?').get(msg.sessionId,msg.id);
    this.db.prepare(`INSERT INTO messages(session_id,id,chat_jid,participant_jid,from_me,timestamp,type,view_once,text,payload_json) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id,id) DO UPDATE SET participant_jid=excluded.participant_jid,from_me=excluded.from_me,timestamp=excluded.timestamp,type=excluded.type,view_once=excluded.view_once,text=excluded.text,payload_json=excluded.payload_json`)
      .run(msg.sessionId,msg.id,msg.chatJid,msg.participantJid,msg.fromMe?1:0,msg.timestamp,msg.type,msg.viewOnce?1:0,msg.text,JSON.stringify(msg));
    const unreadDelta = exists || msg.fromMe ? 0 : 1;
    this.db.prepare(`INSERT INTO chats(session_id,jid,last_message_at,unread_count) VALUES(?,?,?,?) ON CONFLICT(session_id,jid) DO UPDATE SET last_message_at=MAX(last_message_at,excluded.last_message_at),unread_count=unread_count+excluded.unread_count`)
      .run(msg.sessionId,msg.chatJid,msg.timestamp,unreadDelta); return !exists;
  }
  deleteMessage(sessionId,messageId) {
    const row=this.db.prepare('SELECT chat_jid FROM messages WHERE session_id=? AND id=?').get(sessionId,messageId); if(!row)return false;
    this.db.prepare('DELETE FROM messages WHERE session_id=? AND id=?').run(sessionId,messageId);
    const latest=this.db.prepare('SELECT MAX(timestamp) AS latest FROM messages WHERE session_id=? AND chat_jid=?').get(sessionId,row.chat_jid)?.latest??0;
    this.db.prepare('UPDATE chats SET last_message_at=? WHERE session_id=? AND jid=?').run(latest,sessionId,row.chat_jid); return true;
  }
  markLocalRead(sessionId,chatJid){this.db.prepare('UPDATE chats SET unread_count=0 WHERE session_id=? AND jid=?').run(sessionId,chatJid);}
  listChats(sessionId,limit=100){return this.db.prepare(`SELECT c.*,(SELECT m.text FROM messages m WHERE m.session_id=c.session_id AND m.chat_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) AS preview,(SELECT m.type FROM messages m WHERE m.session_id=c.session_id AND m.chat_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) AS preview_type,(SELECT m.from_me FROM messages m WHERE m.session_id=c.session_id AND m.chat_jid=c.jid ORDER BY m.timestamp DESC LIMIT 1) AS preview_from_me FROM chats c WHERE c.session_id=? ORDER BY c.last_message_at DESC LIMIT ?`).all(sessionId,Math.max(1,Math.min(Number(limit)||100,500)));}
  listMessages(sessionId,chatJid,limit=100,before=Number.MAX_SAFE_INTEGER){const rows=this.db.prepare('SELECT payload_json FROM messages WHERE session_id=? AND chat_jid=? AND timestamp<? ORDER BY timestamp DESC LIMIT ?').all(sessionId,chatJid,Number(before),Math.max(1,Math.min(Number(limit)||100,500)));return rows.map(r=>JSON.parse(r.payload_json)).reverse();}
  latestSessionForChat(chatJid){return this.db.prepare('SELECT session_id FROM chats WHERE jid=? ORDER BY last_message_at DESC LIMIT 1').get(chatJid)?.session_id||null;}
  listMessagesAnySession(chatJid,limit=100,before=Number.MAX_SAFE_INTEGER){const sessionId=this.latestSessionForChat(chatJid);return sessionId?this.listMessages(sessionId,chatJid,limit,before):[];}
  close(){try{this.db.close();}catch{}}
}
