import http from 'node:http';
import { URL } from 'node:url';

const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
const readJson=req=>new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1000000)reject(new Error('request-body-too-large'));});req.on('end',()=>{if(!body)return resolve({});try{resolve(JSON.parse(body));}catch(error){reject(error);}});req.on('error',reject);});
function safeError(error){const message=String(error?.message||error||'unknown-error');if(/already paired/i.test(message))return{status:409,error:'already-paired'};if(/pairing already active/i.test(message))return{status:409,error:'pairing-active'};if(/unknown whatsapp session/i.test(message))return{status:404,error:'session-not-found'};if(/valid phone number/i.test(message))return{status:400,error:'invalid-phone-number'};return{status:500,error:'internal-error'};}
function installSse(req,res,events){res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});res.write(`event: ready\ndata: ${JSON.stringify({ok:true,at:Date.now()})}\n\n`);const onEvent=event=>{res.write(`id: ${event.id}\n`);res.write(`event: ${event.type}\n`);res.write(`data: ${JSON.stringify(event)}\n\n`);};events.on('event',onEvent);const heartbeat=setInterval(()=>res.write(': ping\n\n'),20000);heartbeat.unref?.();const close=()=>{clearInterval(heartbeat);events.off('event',onEvent);};req.on('close',close);req.on('aborted',close);}

export function createCortexServer({config,registry,roleManager,sessions,pairing,inbox,access,events}){
  const token=String(config.get('CORTEX_API_TOKEN',''));const auth=req=>token&&req.headers.authorization===`Bearer ${token}`;
  return http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health')return json(res,200,{ok:true,service:'night-core',sessions:sessions.snapshot(),roles:roleManager.snapshot()});
    if(!auth(req))return json(res,401,{error:'unauthorized'});
    if(req.method==='GET'&&url.pathname==='/api/cortex/events')return installSse(req,res,events);
    if(req.method==='GET'&&url.pathname==='/api/cortex/config')return json(res,200,config.publicSnapshot());
    if(req.method==='GET'&&url.pathname==='/api/cortex/commands')return json(res,200,registry.snapshot());
    if(req.method==='GET'&&url.pathname==='/api/cortex/sessions')return json(res,200,{sessions:sessions.snapshot(),roles:roleManager.snapshot()});
    if(req.method==='GET'&&url.pathname==='/api/cortex/access')return json(res,200,{allowedChats:access.list()});
    if(req.method==='GET'&&url.pathname==='/api/cortex/pairing')return json(res,200,pairing.all());

    if(req.method==='PUT'&&url.pathname==='/api/cortex/roles'){
      const body=await readJson(req);const next=roleManager.configure(body);
      if(body.mode!=null)config.setOverride('WHATSAPP_ROLE_MODE',next.mode);
      if(body.inboxSession!=null)config.setOverride('WHATSAPP_INBOX_SESSION',next.inboxSession);
      if(body.aiSession!=null)config.setOverride('WHATSAPP_AI_SESSION',next.aiSession);
      if(body.fallbackEnabled!=null)config.setOverride('WHATSAPP_FALLBACK_ENABLED',next.fallbackEnabled);
      events.publish('roles.update',roleManager.snapshot());return json(res,200,roleManager.snapshot());
    }

    if(req.method==='POST'&&url.pathname==='/api/cortex/access'){
      const body=await readJson(req);if(!body.chatJid)return json(res,400,{error:'chat-jid-required'});access.allow(body.chatJid);events.publish('access.update',{allowedChats:access.list()});return json(res,200,{allowedChats:access.list()});
    }
    if(req.method==='DELETE'&&url.pathname==='/api/cortex/access'){
      const body=await readJson(req);if(!body.chatJid)return json(res,400,{error:'chat-jid-required'});access.disallow(body.chatJid);events.publish('access.update',{allowedChats:access.list()});return json(res,200,{allowedChats:access.list()});
    }

    const pairMatch=url.pathname.match(/^\/api\/cortex\/pairing\/([^/]+)(?:\/(code|qr))?$/);
    if(pairMatch){const sessionId=decodeURIComponent(pairMatch[1]);const action=pairMatch[2]??null;
      if(req.method==='GET'&&!action)return json(res,200,pairing.snapshot(sessionId));
      if(req.method==='DELETE'&&!action){const cancelled=await pairing.cancel(sessionId);return json(res,200,{cancelled,pairing:pairing.snapshot(sessionId)});}
      if(req.method==='POST'&&action==='code'){const body=await readJson(req);const result=await pairing.startCode(sessionId,body.phoneNumber);return json(res,202,result);}
      if(req.method==='POST'&&action==='qr'){const result=await pairing.startQr(sessionId);return json(res,202,result);}
    }

    const sessionMatch=url.pathname.match(/^\/api\/cortex\/sessions\/([^/]+)\/(reconnect|disconnect|logout)$/);
    if(sessionMatch&&req.method==='POST'){const sessionId=decodeURIComponent(sessionMatch[1]);const action=sessionMatch[2];if(action==='reconnect')await sessions.reconnect(sessionId);else if(action==='disconnect')await sessions.disconnect(sessionId);else if(action==='logout')await sessions.logout(sessionId);return json(res,202,sessions.sessionSnapshot(sessionId));}

    if(req.method==='GET'&&url.pathname==='/api/cortex/inbox/chats'){const sessionId=url.searchParams.get('session')||roleManager.resolve('inbox')||config.get('WHATSAPP_INBOX_SESSION','main');return json(res,200,inbox.listChats(sessionId,Number(url.searchParams.get('limit')||100)));}
    const msgMatch=url.pathname.match(/^\/api\/cortex\/inbox\/chats\/(.+)\/messages$/);
    if(msgMatch&&req.method==='GET'){const jid=decodeURIComponent(msgMatch[1]);const sessionId=url.searchParams.get('session')||roleManager.resolve('inbox')||config.get('WHATSAPP_INBOX_SESSION','main');return json(res,200,inbox.listMessages(sessionId,jid,Number(url.searchParams.get('limit')||100),Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER)));}
    if(msgMatch&&req.method==='POST'){const jid=decodeURIComponent(msgMatch[1]);if(!access.isAllowed(jid))return json(res,403,{error:'chat-disabled'});const body=await readJson(req);if(!body.text&&!body.content)return json(res,400,{error:'message-content-required'});const sessionId=body.sessionId||roleManager.resolve('inbox');if(!sessionId)return json(res,503,{error:'no-inbox-session'});const sent=await sessions.sendViaSession(sessionId,jid,body.content??{text:body.text});events.publish('message.outbound.accepted',{sessionId,jid,id:sent?.key?.id??null});return json(res,202,{accepted:true,sessionId,id:sent?.key?.id??null});}

    const reloadMatch=url.pathname.match(/^\/api\/cortex\/commands\/([^/]+)\/reload$/);
    if(reloadMatch&&req.method==='POST'){const cmd=registry.resolveCommand(decodeURIComponent(reloadMatch[1]));if(!cmd)return json(res,404,{error:'command-not-found'});const ok=await registry.reloadFile(cmd.__file,'command');events.publish(ok?'command.reloaded':'command.reload-failed',{name:cmd.name});return json(res,ok?200:500,{ok});}
    return json(res,404,{error:'not-found'});
  }catch(error){const safe=safeError(error);return json(res,safe.status,{error:safe.error,message:process.env.NODE_ENV==='development'?error.message:undefined});}});
}
