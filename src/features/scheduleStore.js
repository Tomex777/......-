import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const clamp = (v,min,max,fallback)=>Math.max(min,Math.min(Number(v)||fallback,max));
const parse = value => { try { return JSON.parse(value); } catch { return null; } };

export class ScheduleStore {
  constructor(dbPath = path.resolve('data/night.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive:true, mode:0o700 });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS scheduled_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        due_at INTEGER NOT NULL,
        recurrence_ms INTEGER,
        action TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        session_id TEXT NOT NULL,
        chat_jid TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        last_fired_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_due ON scheduled_actions(active,due_at);`);
  }
  add({ dueAt, recurrenceMs=null, action, payload={}, sessionId, chatJid=null }) {
    const result=this.db.prepare(`INSERT INTO scheduled_actions(created_at,due_at,recurrence_ms,action,payload_json,session_id,chat_jid) VALUES(?,?,?,?,?,?,?)`)
      .run(Date.now(),Number(dueAt),recurrenceMs==null?null:Number(recurrenceMs),String(action),JSON.stringify(payload||{}),String(sessionId),chatJid==null?null:String(chatJid));
    return Number(result.lastInsertRowid);
  }
  list(limit=50) { return this.db.prepare('SELECT * FROM scheduled_actions WHERE active=1 ORDER BY due_at ASC LIMIT ?').all(clamp(limit,1,500,50)).map(this.#row); }
  due(at=Date.now(),limit=50) { return this.db.prepare('SELECT * FROM scheduled_actions WHERE active=1 AND due_at<=? ORDER BY due_at ASC LIMIT ?').all(Number(at),clamp(limit,1,200,50)).map(this.#row); }
  markFired(id, firedAt=Date.now()) {
    const row=this.db.prepare('SELECT due_at,recurrence_ms FROM scheduled_actions WHERE id=?').get(Number(id)); if(!row)return false;
    if(row.recurrence_ms&&Number(row.recurrence_ms)>0){let next=Number(row.due_at)+Number(row.recurrence_ms);while(next<=firedAt)next+=Number(row.recurrence_ms);this.db.prepare('UPDATE scheduled_actions SET due_at=?,last_fired_at=? WHERE id=?').run(next,Number(firedAt),Number(id));}
    else this.db.prepare('UPDATE scheduled_actions SET active=0,last_fired_at=? WHERE id=?').run(Number(firedAt),Number(id));
    return true;
  }
  delete(id){return Number(this.db.prepare('DELETE FROM scheduled_actions WHERE id=?').run(Number(id)).changes)>0;}
  #row(row){return{...row,id:Number(row.id),due_at:Number(row.due_at),recurrence_ms:row.recurrence_ms==null?null:Number(row.recurrence_ms),payload:parse(row.payload_json)||{}};}
  close(){try{this.db.close();}catch{}}
}
