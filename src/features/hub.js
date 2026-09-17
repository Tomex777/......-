import QRCode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { Chess } from 'chess.js';
import { FeatureStore } from './store.js';
import { AzureFeatureClient } from './azure.js';
import { animeList, mangaList, meme, gifSearch, pinterestLinks } from './content.js';
import { downloadQuotedMedia, quotedText, toSticker, stickerToImage, resizeImage, compressImage, redactImage, transcodeToMp4 } from './media.js';
import { extractDocument } from './documents.js';
import { fetchPublicFile } from './download.js';
import { renderTableImage, renderTablePdf, renderTextPdf } from './render.js';

const fmtDate = t => new Date(Number(t)).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'});
const words = ['planet','window','shadow','orange','silver','forest','castle','bridge','rocket','camera','winter','summer','coffee','puzzle','violet','thunder'];
const trivia = [
  {q:'What is the largest planet in our Solar System?',a:'jupiter'},
  {q:'What gas do plants absorb from the atmosphere?',a:'carbon dioxide'},
  {q:'How many squares are on a chess board?',a:'64'},
  {q:'What is the capital of Japan?',a:'tokyo'},
  {q:'Which ocean is the largest?',a:'pacific'}
];
const wyr = [
  ['Always know when someone is lying','Always get away with one lie a day'],
  ['Travel ten years into the past','Travel ten years into the future'],
  ['Give up music for a year','Give up movies and series for a year'],
  ['Have unlimited battery','Have unlimited mobile data']
];

export class CapabilityHub {
  constructor({ config, sessions, inbox, ai, logger=console, store=null }={}) {
    this.config=config; this.sessions=sessions; this.inbox=inbox; this.ai=ai; this.logger=logger;
    this.store=store||new FeatureStore();
    this.azure=new AzureFeatureClient({config});
    this.timer=setInterval(()=>this.#fireReminders().catch(e=>this.logger.warn?.({err:e.message},'reminder tick failed')),15_000);
    this.timer.unref?.();
  }

  close(){clearInterval(this.timer);this.store.close();}

  async #fireReminders(){
    for(const row of this.store.dueReminders(Date.now(),100)){
      try{await this.sessions.sendViaSession(row.session_id,row.chat_jid,{text:`Reminder: ${row.text}`});this.store.markReminderFired(row);}catch(e){this.logger.warn?.({reminderId:row.id,err:e.message},'reminder tick failed');}
    }
  }

  parseWhen(text){
    const input=String(text||'').trim(); const now=Date.now();
    const m=input.match(/^in\s+(\d+(?:\.\d+)?)\s*(minute|minutes|min|hour|hours|hr|day|days|week|weeks)\b/i);
    if(m){const n=Number(m[1]);const unit=m[2].toLowerCase();const mult=unit.startsWith('min')?60000:unit.startsWith('h')?3600000:unit.startsWith('d')?86400000:604800000;return {at:now+n*mult,rest:input.slice(m[0].length).trim()};}
    const iso=input.match(/^(\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2})?)/);
    if(iso){const at=Date.parse(iso[1]);if(Number.isFinite(at))return{at,rest:input.slice(iso[1].length).trim()};}
    const tomorrow=input.match(/^tomorrow(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if(tomorrow){let h=Number(tomorrow[1]);const min=Number(tomorrow[2]||0);const ap=(tomorrow[3]||'').toLowerCase();if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;const d=new Date();d.setDate(d.getDate()+1);d.setHours(h,min,0,0);return{at:d.getTime(),rest:input.slice(tomorrow[0].length).trim()};}
    return null;
  }

  async reminder({text,sessionId,chatJid}){const p=this.parseWhen(text);if(!p||!p.rest)throw new Error('Use a time like: .remind in 30 minutes call Mum');const id=this.store.addReminder({dueAt:p.at,sessionId,chatJid,text:p.rest});return{id,dueAt:p.at,text:p.rest};}
  reminders(){return this.store.listReminders();}
  cancelReminder(id){return this.store.cancelReminder(id);}

  saveText({text,chatJid,messageId,title=null,kind='text'}){const id=this.store.addLibrary({kind,title,text,chatJid,messageId});return{id};}
  libraryRecent(n=25){return this.store.recentLibrary(n);}
  libraryFind(q,n=50){return this.store.searchLibrary(q,n);}
  libraryDelete(id){return this.store.deleteLibrary(id);}
  libraryArchive(id){return this.store.archiveLibrary(id);}
  storageStats(){return{items:this.store.libraryCount(),notes:this.store.listNotes(1000).length,todos:this.store.listTodos({includeDone:true,n:1000}).length,reminders:this.store.listReminders(1000).length,observed:this.store.observed().length};}

  noteAdd(text){return this.store.addNote(text);}
  notes(q=''){return q?this.store.findNotes(q):this.store.listNotes();}
  noteDelete(id){return this.store.deleteNote(id);}
  todoAdd(text,dueAt=null){return this.store.addTodo(text,dueAt);}
  todos(includeDone=false){return this.store.listTodos({includeDone});}
  todoDone(id){return this.store.completeTodo(id);}
  todoDelete(id){return this.store.deleteTodo(id);}

  observe(jid,label=null){this.store.observe(jid,label);return true;}
  unobserve(jid){return this.store.unobserve(jid);}
  isObserved(jid){return this.store.isObserved(jid);}
  observed(){return this.store.observed();}

  async catchup({sessionId,chatJid,limit=150}){
    const messages=this.inbox.listMessages(sessionId,chatJid,limit).filter(x=>x.text);
    if(!messages.length)throw new Error('No stored messages are available for that chat.');
    const transcript=messages.map(x=>`[${fmtDate(x.timestamp)}] ${x.pushName||x.participantJid||x.senderJid||'Someone'}: ${x.text}`).join('\n');
    return this.ai.summarize({text:`Summarize this WhatsApp catch-up. Include important decisions, plans, links, disagreements and action items.\n\n${transcript}`,sessionId,chatJid:`catchup:${chatJid}`});
  }

  async semanticMessageSearch({sessionId,chatJid,query,limit=300}){
    const messages=this.inbox.listMessages(sessionId,chatJid,limit).filter(x=>x.text);
    if(!messages.length)return[];
    const listing=messages.map((x,i)=>`${i+1}. [${fmtDate(x.timestamp)}] ${x.pushName||x.participantJid||'Someone'}: ${x.text}`).join('\n');
    const r=await this.ai.ask({text:`Find the messages most relevant to this request: ${query}\nReturn at most 8 matching numbered lines, preserving their original wording and dates.\n\n${listing}`,sessionId,chatJid:`semantic:${chatJid}`,remember:false,complexity:.4});
    return r.text;
  }

  async sticker(raw){const media=await downloadQuotedMedia(raw);return toSticker(media);}
  async toImage(raw){const media=await downloadQuotedMedia(raw);if(media.kind!=='sticker')throw new Error('Reply to a sticker with .toimg');return stickerToImage(media.buffer);}
  async compress(raw){const media=await downloadQuotedMedia(raw);if(media.kind!=='image')throw new Error('Reply to an image with .compress');return compressImage(media.buffer);}
  async resize(raw,width){const media=await downloadQuotedMedia(raw);if(media.kind!=='image')throw new Error('Reply to an image with .resize');return resizeImage(media.buffer,{width});}
  async redact(raw,args={}){const media=await downloadQuotedMedia(raw);if(media.kind!=='image')throw new Error('Reply to an image with .redact');return redactImage(media.buffer,args);}
  async toVideo(raw){const media=await downloadQuotedMedia(raw);return transcodeToMp4(media.buffer);}
  async transcribe(raw){const media=await downloadQuotedMedia(raw);if(!['audio','video'].includes(media.kind))throw new Error('Reply to a voice note, audio or video.');return this.azure.transcribe(media.buffer);}
  async vision(raw){const media=await downloadQuotedMedia(raw);if(media.kind!=='image')throw new Error('Reply to an image.');return this.azure.vision(media.buffer);}
  async image(prompt){return this.azure.generateImage(prompt);}
  async tts(text){return this.azure.speak(text,{voice:this.config.get('AZURE_TTS_VOICE','en-NG-AbeoNeural')});}
  async readDocument(raw){return extractDocument(raw);}
  async download(url){return fetchPublicFile(url);}
  async openViewOnce(raw){return downloadQuotedMedia(raw);}
  async scanQr(raw){
    const media=await downloadQuotedMedia(raw);
    if(media.kind!=='image')throw new Error('Reply to an image containing a QR code.');
    const {data,info}=await sharp(media.buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const code=jsQR(new Uint8ClampedArray(data),info.width,info.height);
    if(!code?.data)throw new Error('No QR code found in that image.');
    return code.data;
  }

  async postStatus({sessionId,text=null,raw=null}){
    const sock=this.sessions.getSocket(sessionId);if(!sock)throw new Error('WhatsApp session is not connected.');
    let content=null;
    if(raw){try{const media=await downloadQuotedMedia(raw);if(media.kind==='image')content={image:media.buffer,caption:text||''};else if(media.kind==='video')content={video:media.buffer,caption:text||''};else if(media.kind==='audio')content={audio:media.buffer,mimetype:media.mimetype||'audio/ogg',ptt:false};}catch{}}
    if(!content){if(!text)throw new Error('Provide text or reply to image/video media.');content={text};}
    return this.sessions.sendViaSession(sessionId,'status@broadcast',content);
  }

  async poll({sessionId,chatJid,question,options,selectableCount=1}){
    if(options.length<2)throw new Error('A poll needs at least two options.');
    return this.sessions.sendViaSession(sessionId,chatJid,{poll:{name:question,values:options.slice(0,12),selectableCount:Math.max(1,Math.min(Number(selectableCount)||1,options.length))}});
  }

  async qr(text){return QRCode.toBuffer(String(text),{type:'png',width:768,margin:2,errorCorrectionLevel:'M'});}
  anime(mode,q){return animeList(mode,q);}
  manga(mode,q){return mangaList(mode,q);}
  memes(dark=false){return meme({dark});}
  gifs(q){return gifSearch(q);}
  pinterest(q){return pinterestLinks(q,this.ai);}

  async table(spec){return renderTableImage(spec);}
  async tablePdf(spec){return renderTablePdf(spec);}
  async pdf(spec){return renderTextPdf(spec);}

  chess(chatJid,input=''){
    const existing=this.store.loadChess(chatJid);const chess=new Chess(existing?.fen||undefined);const cmd=String(input||'').trim().toLowerCase();
    if(!cmd||cmd==='board'||cmd==='status')return{fen:chess.fen(),ascii:chess.ascii(),turn:chess.turn(),gameOver:chess.isGameOver()};
    if(cmd==='new'||cmd==='reset'){chess.reset();this.store.saveChess(chatJid,chess.fen(),{});return{fen:chess.fen(),ascii:chess.ascii(),turn:chess.turn(),reset:true};}
    let move=null;try{move=chess.move(input);}catch{}
    if(!move)throw new Error('Invalid chess move. Use SAN such as e4, Nf3, O-O, or a move like e2e4.');
    this.store.saveChess(chatJid,chess.fen(),{});return{move,fen:chess.fen(),ascii:chess.ascii(),turn:chess.turn(),gameOver:chess.isGameOver(),checkmate:chess.isCheckmate(),draw:chess.isDraw()};
  }

  hangman(chatJid,input=''){
    let state=this.store.loadGame(chatJid,'hangman');const cmd=String(input||'').trim().toLowerCase();
    if(!state||cmd==='new'){const word=words[Math.floor(Math.random()*words.length)];state={word,guesses:[],wrong:0,max:6};this.store.saveGame(chatJid,'hangman',state);}
    else if(cmd){const ch=cmd[0];if(/[a-z]/.test(ch)&&!state.guesses.includes(ch)){state.guesses.push(ch);if(!state.word.includes(ch))state.wrong++;this.store.saveGame(chatJid,'hangman',state);}}
    const shown=[...state.word].map(c=>state.guesses.includes(c)?c:'_').join(' ');const won=!shown.includes('_');const lost=state.wrong>=state.max;if(won||lost)this.store.clearGame(chatJid,'hangman');return{shown,wrong:state.wrong,max:state.max,won,lost,word:(won||lost)?state.word:null};
  }

  trivia(chatJid,input=''){
    let state=this.store.loadGame(chatJid,'trivia');const cmd=String(input||'').trim();
    if(!state||/^new$/i.test(cmd)){const item=trivia[Math.floor(Math.random()*trivia.length)];state={q:item.q,a:item.a};this.store.saveGame(chatJid,'trivia',state);return{question:state.q};}
    const correct=cmd.toLowerCase()===state.a.toLowerCase();const answer=state.a;this.store.clearGame(chatJid,'trivia');return{correct,answer,question:state.q};
  }

  wordchain(chatJid,input=''){
    let state=this.store.loadGame(chatJid,'wordchain')||{last:null,used:[]};const word=String(input||'').trim().toLowerCase();
    if(!word||word==='new'){state={last:null,used:[]};this.store.saveGame(chatJid,'wordchain',state);return{message:'Start with any English word.'};}
    if(!/^[a-z]{2,}$/.test(word))throw new Error('Send one alphabetic word.');if(state.used.includes(word))throw new Error('That word has already been used.');if(state.last&&word[0]!==state.last.slice(-1))throw new Error(`Your word must start with “${state.last.slice(-1)}”.`);
    state.used.push(word);state.last=word;this.store.saveGame(chatJid,'wordchain',state);return{last:word,count:state.used.length,next:word.slice(-1)};
  }

  wouldYouRather(){const x=wyr[Math.floor(Math.random()*wyr.length)];return{a:x[0],b:x[1]};}
}
