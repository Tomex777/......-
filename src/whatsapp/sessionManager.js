import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import pino from 'pino';
import { normalizeMessage } from './normalizeMessage.js';

export class NightSessionManager extends EventEmitter {
  constructor({ dataDir = path.resolve('data/sessions'), roleManager } = {}) {
    super(); this.dataDir = dataDir; this.roleManager = roleManager; this.sessions = new Map();
    this.logger = pino({ level: process.env.NIGHT_LOG_LEVEL || 'info' }); fs.mkdirSync(this.dataDir, { recursive: true });
  }
  async #library() { return import('@itsliaaa/baileys'); }
  authDir(sessionId) { return path.join(this.dataDir, String(sessionId).toLowerCase()); }
  async connect(sessionId) {
    const id = String(sessionId).toLowerCase(); const current = this.sessions.get(id);
    if (current?.state === 'open' || current?.state === 'connecting') return current.socket;
    const lib = await this.#library(); const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = lib;
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir(id));
    const record = { id, state:'connecting', socket:null, reconnectTimer:null, reconnects:0, saveCreds }; this.sessions.set(id, record); this.roleManager?.markHealth(id,false);
    const socketOptions = { auth:state, logger:this.logger.child({session:id}), browser:Browsers.macOS('Chrome'), markOnlineOnConnect:false, syncFullHistory:false };
    const override = String(process.env.NIGHT_WA_VERSION || '').trim(); if (override) socketOptions.version = override.split(',').map(Number);
    const sock = makeWASocket(socketOptions); record.socket = sock;
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', ({messages=[]}) => { for (const raw of messages) this.emit('message', normalizeMessage(raw,{sessionId:id}), raw); });
    sock.ev.on('messages.update', update => this.emit('messages.update',{sessionId:id,update}));
    sock.ev.on('messages.delete', update => this.emit('messages.delete',{sessionId:id,update}));
    sock.ev.on('messages.reaction', update => this.emit('messages.reaction',{sessionId:id,update}));
    sock.ev.on('messaging-history.set', history => this.emit('history',{sessionId:id,history}));
    sock.ev.on('connection.update', update => {
      if (update.connection === 'open') { record.state='open'; record.reconnects=0; this.roleManager?.markHealth(id,true); this.emit('session',{sessionId:id,state:'open'}); }
      else if (update.connection === 'close') { record.state='closed'; this.roleManager?.markHealth(id,false); this.emit('session',{sessionId:id,state:'closed',error:String(update.lastDisconnect?.error??'')}); const status=update.lastDisconnect?.error?.output?.statusCode??update.lastDisconnect?.error?.statusCode; if (status !== DisconnectReason.loggedOut) this.#scheduleReconnect(id); }
      else if (update.connection === 'connecting') { record.state='connecting'; this.emit('session',{sessionId:id,state:'connecting',qr:update.qr??null}); }
    });
    return sock;
  }
  #scheduleReconnect(sessionId) {
    const record=this.sessions.get(sessionId); if (!record || record.reconnectTimer) return;
    const delay=Math.min(30000,1500*(2**Math.min(record.reconnects++,4)));
    record.reconnectTimer=setTimeout(async()=>{ record.reconnectTimer=null; try { await this.connect(sessionId); } catch(error) { this.logger.error({sessionId,err:error},'reconnect failed'); this.#scheduleReconnect(sessionId); } },delay);
  }
  async send(role,jid,content,options={}) { const sessionId=this.roleManager?.resolve(role)??role; if(!sessionId) throw new Error(`No healthy WhatsApp session for role ${role}`); const record=this.sessions.get(sessionId); if(!record?.socket||record.state!=='open') throw new Error(`Session ${sessionId} is not connected`); return record.socket.sendMessage(jid,content,options); }
  snapshot() { return [...this.sessions.values()].map(r=>({id:r.id,state:r.state,reconnects:r.reconnects})); }
}
