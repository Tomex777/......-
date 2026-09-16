import path from 'node:path';
import pino from 'pino';
import { ConfigRegistry } from './config/registry.js';
import { AccessController } from './security/access.js';
import { SessionRoleManager } from './whatsapp/roles.js';
import { HotModuleRegistry } from './hotload/registry.js';
import { InboxStore } from './inbox/store.js';
import { NightSessionManager } from './whatsapp/sessionManager.js';
import { PairingService } from './whatsapp/pairingService.js';
import { MessageDispatcher } from './router/dispatcher.js';
import { CortexEventHub } from './api/eventHub.js';
import { createCortexServer } from './api/server.js';

const logger=pino({level:process.env.NIGHT_LOG_LEVEL||'info'});
const config=new ConfigRegistry();const runtime=config.runtime();
const access=new AccessController({ownerNumber:runtime.ownerNumber});
const roleManager=new SessionRoleManager({sessions:runtime.sessions,mode:runtime.roleMode,inboxSession:runtime.inboxSession,aiSession:runtime.aiSession,fallbackEnabled:runtime.fallbackEnabled});
const registry=new HotModuleRegistry({commandDir:path.resolve('commands'),utilDir:path.resolve('utils')});await registry.loadAll();registry.startWatching();
const inbox=new InboxStore();const events=new CortexEventHub();const sessions=new NightSessionManager({roleManager});
const pairing=new PairingService({sessions,allowedSessions:runtime.sessions});
const dispatcher=new MessageDispatcher({registry,access,sessions,config,roleManager,logger});

registry.on('loaded',data=>events.publish('module.loaded',data));
registry.on('load-error',data=>events.publish('module.load-error',{kind:data.kind,file:data.file,error:data.error?.message}));
registry.on('watch-error',error=>events.publish('module.watch-error',{error:error.message}));
sessions.on('session',state=>events.publish('session.update',state));
sessions.on('qr',state=>events.publish('pairing.qr',state));
sessions.on('creds',state=>events.publish('session.credentials',state));
sessions.on('messages.update',state=>events.publish('message.update',state));
sessions.on('messages.delete',state=>events.publish('message.delete',state));
sessions.on('messages.reaction',state=>events.publish('message.reaction',state));
pairing.on('update',state=>events.publish('pairing.update',state));

sessions.on('message',async(message,raw)=>{
  events.publish('message.received',{sessionId:message.sessionId,chatJid:message.chatJid,id:message.id,type:message.type,fromMe:message.fromMe});
  const dispatched=await dispatcher.handle(message,raw);
  if(dispatched.handled)events.publish('command.dispatch',{sessionId:message.sessionId,chatJid:message.chatJid,...dispatched,error:dispatched.error?.message});
  if(message.chatJid&&access.isAllowed(message.chatJid)){inbox.upsertMessage(message);events.publish('inbox.message',message);}
});

for(const sessionId of runtime.sessions){
  if(!sessions.hasStoredAuth(sessionId)){events.publish('session.unpaired',{sessionId});continue;}
  sessions.connect(sessionId).catch(error=>{logger.warn({sessionId,err:error.message},'startup WhatsApp connection failed');events.publish('session.startup-error',{sessionId,error:error.message});});
}

const server=createCortexServer({config,registry,roleManager,sessions,pairing,inbox,access,events});
server.listen(runtime.port,()=>logger.info({port:runtime.port},'Night Core listening'));
let shuttingDown=false;
const shutdown=async signal=>{if(shuttingDown)return;shuttingDown=true;logger.info({signal},'Night shutting down');registry.stopWatching();server.close();await sessions.closeAll();inbox.close();setTimeout(()=>process.exit(1),5000).unref();process.exit(0);};
process.on('SIGINT',()=>shutdown('SIGINT'));process.on('SIGTERM',()=>shutdown('SIGTERM'));
