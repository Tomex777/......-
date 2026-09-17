import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const json = value => { try { return JSON.parse(value); } catch { return null; } };
const limit = (n, fallback = 50, max = 1000) => Math.max(1, Math.min(Number(n) || fallback, max));

export class FeatureStore {
  constructor(dbPath = path.resolve('data/night.sqlite')) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS library_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        kind TEXT NOT NULL,
        title TEXT,
        text TEXT,
        url TEXT,
        file_path TEXT,
        chat_jid TEXT,
        message_id TEXT,
        metadata_json TEXT,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_library_created ON library_items(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_library_kind ON library_items(kind,created_at DESC);

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        title TEXT,
        body TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        text TEXT NOT NULL,
        due_at INTEGER,
        done INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at INTEGER NOT NULL,
        due_at INTEGER NOT NULL,
        chat_jid TEXT NOT NULL,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        recurrence_ms INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_fired_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(enabled,due_at);

      CREATE TABLE IF NOT EXISTS observed_chats (
        jid TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        label TEXT
      );

      CREATE TABLE IF NOT EXISTS chess_games (
        chat_jid TEXT PRIMARY KEY,
        fen TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS game_state (
        chat_jid TEXT NOT NULL,
        game TEXT NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(chat_jid,game)
      );
    `);
  }

  addLibrary(item = {}) {
    const info = this.db.prepare(`INSERT INTO library_items(created_at,kind,title,text,url,file_path,chat_jid,message_id,metadata_json,archived)
      VALUES(?,?,?,?,?,?,?,?,?,0)`).run(
      Number(item.createdAt || Date.now()), String(item.kind || 'item'), item.title ?? null, item.text ?? null,
      item.url ?? null, item.filePath ?? null, item.chatJid ?? null, item.messageId ?? null,
      item.metadata ? JSON.stringify(item.metadata) : null
    );
    return Number(info.lastInsertRowid);
  }

  recentLibrary(n = 25) {
    return this.db.prepare('SELECT * FROM library_items WHERE archived=0 ORDER BY created_at DESC,id DESC LIMIT ?').all(limit(n,25,500)).map(this.#libraryRow);
  }

  searchLibrary(query, n = 50) {
    const q = `%${String(query || '').trim()}%`;
    return this.db.prepare(`SELECT * FROM library_items WHERE archived=0 AND (title LIKE ? OR text LIKE ? OR url LIKE ? OR metadata_json LIKE ?) ORDER BY created_at DESC,id DESC LIMIT ?`)
      .all(q,q,q,q,limit(n,50,500)).map(this.#libraryRow);
  }

  getLibrary(id) { const row=this.db.prepare('SELECT * FROM library_items WHERE id=?').get(Number(id)); return row ? this.#libraryRow(row) : null; }
  deleteLibrary(id) { return this.db.prepare('DELETE FROM library_items WHERE id=?').run(Number(id)).changes > 0; }
  archiveLibrary(id) { return this.db.prepare('UPDATE library_items SET archived=1 WHERE id=?').run(Number(id)).changes > 0; }
  libraryCount() { return Number(this.db.prepare('SELECT COUNT(*) AS n FROM library_items WHERE archived=0').get()?.n || 0); }

  addNote(body, title = null) {
    const now=Date.now(); const info=this.db.prepare('INSERT INTO notes(created_at,updated_at,title,body,archived) VALUES(?,?,?,?,0)').run(now,now,title,String(body)); return Number(info.lastInsertRowid);
  }
  listNotes(n=50){return this.db.prepare('SELECT * FROM notes WHERE archived=0 ORDER BY updated_at DESC,id DESC LIMIT ?').all(limit(n,50,500));}
  findNotes(query,n=50){const q=`%${String(query||'').trim()}%`;return this.db.prepare('SELECT * FROM notes WHERE archived=0 AND (title LIKE ? OR body LIKE ?) ORDER BY updated_at DESC LIMIT ?').all(q,q,limit(n,50,500));}
  deleteNote(id){return this.db.prepare('DELETE FROM notes WHERE id=?').run(Number(id)).changes>0;}

  addTodo(text,dueAt=null){const info=this.db.prepare('INSERT INTO todos(created_at,text,due_at,done) VALUES(?,?,?,0)').run(Date.now(),String(text),dueAt?Number(dueAt):null);return Number(info.lastInsertRowid);}
  listTodos({includeDone=false,n=100}={}){return this.db.prepare(`SELECT * FROM todos ${includeDone?'':'WHERE done=0 '}ORDER BY done ASC,COALESCE(due_at,9223372036854775807),id DESC LIMIT ?`).all(limit(n,100,500));}
  completeTodo(id){return this.db.prepare('UPDATE todos SET done=1 WHERE id=?').run(Number(id)).changes>0;}
  deleteTodo(id){return this.db.prepare('DELETE FROM todos WHERE id=?').run(Number(id)).changes>0;}

  addReminder({dueAt,chatJid,sessionId,text,recurrenceMs=null}){
    const info=this.db.prepare('INSERT INTO reminders(created_at,due_at,chat_jid,session_id,text,recurrence_ms,enabled) VALUES(?,?,?,?,?,?,1)').run(Date.now(),Number(dueAt),chatJid,sessionId,String(text),recurrenceMs?Number(recurrenceMs):null);return Number(info.lastInsertRowid);
  }
  dueReminders(now=Date.now(),n=100){return this.db.prepare('SELECT * FROM reminders WHERE enabled=1 AND due_at<=? ORDER BY due_at ASC LIMIT ?').all(Number(now),limit(n,100,500));}
  listReminders(n=100){return this.db.prepare('SELECT * FROM reminders WHERE enabled=1 ORDER BY due_at ASC LIMIT ?').all(limit(n,100,500));}
  markReminderFired(row,now=Date.now()){
    if(row.recurrence_ms){this.db.prepare('UPDATE reminders SET due_at=?,last_fired_at=? WHERE id=?').run(Number(row.due_at)+Number(row.recurrence_ms),Number(now),row.id);}
    else this.db.prepare('UPDATE reminders SET enabled=0,last_fired_at=? WHERE id=?').run(Number(now),row.id);
  }
  cancelReminder(id){return this.db.prepare('UPDATE reminders SET enabled=0 WHERE id=?').run(Number(id)).changes>0;}

  observe(jid,label=null){this.db.prepare('INSERT INTO observed_chats(jid,created_at,label) VALUES(?,?,?) ON CONFLICT(jid) DO UPDATE SET label=COALESCE(excluded.label,label)').run(jid,Date.now(),label);}
  unobserve(jid){return this.db.prepare('DELETE FROM observed_chats WHERE jid=?').run(jid).changes>0;}
  isObserved(jid){return Boolean(this.db.prepare('SELECT 1 FROM observed_chats WHERE jid=?').get(jid));}
  observed(){return this.db.prepare('SELECT * FROM observed_chats ORDER BY created_at DESC').all();}

  saveChess(chatJid,fen,metadata={}){this.db.prepare('INSERT INTO chess_games(chat_jid,fen,updated_at,metadata_json) VALUES(?,?,?,?) ON CONFLICT(chat_jid) DO UPDATE SET fen=excluded.fen,updated_at=excluded.updated_at,metadata_json=excluded.metadata_json').run(chatJid,fen,Date.now(),JSON.stringify(metadata));}
  loadChess(chatJid){const row=this.db.prepare('SELECT * FROM chess_games WHERE chat_jid=?').get(chatJid);return row?{...row,metadata:json(row.metadata_json)||{}}:null;}
  clearChess(chatJid){return this.db.prepare('DELETE FROM chess_games WHERE chat_jid=?').run(chatJid).changes>0;}

  saveGame(chatJid,game,state){this.db.prepare('INSERT INTO game_state(chat_jid,game,state_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(chat_jid,game) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at').run(chatJid,game,JSON.stringify(state),Date.now());}
  loadGame(chatJid,game){const row=this.db.prepare('SELECT state_json FROM game_state WHERE chat_jid=? AND game=?').get(chatJid,game);return row?json(row.state_json):null;}
  clearGame(chatJid,game){return this.db.prepare('DELETE FROM game_state WHERE chat_jid=? AND game=?').run(chatJid,game).changes>0;}

  #libraryRow(row){return {...row,archived:Boolean(row.archived),metadata:row.metadata_json?json(row.metadata_json):null};}
  close(){try{this.db.close();}catch{}}
}
