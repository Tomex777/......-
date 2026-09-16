import path from 'node:path';
import { ConfigRegistry } from './config/registry.js';
import { AccessController } from './security/access.js';
import { SessionRoleManager } from './whatsapp/roles.js';
import { HotModuleRegistry } from './hotload/registry.js';
import { InboxStore } from './inbox/store.js';
import { NightSessionManager } from './whatsapp/sessionManager.js';
import { createCortexServer } from './api/server.js';

const config=new ConfigRegistry(); const runtime=config.runtime();
const access=new AccessController({ownerNumber:runtime.ownerNumber});
const roleManager=new SessionRoleManager({sessions:runtime.sessions,mode:runtime.roleMode,inboxSession:runtime.inboxSession,aiSession:runtime.aiSession,fallbackEnabled:runtime.fallbackEnabled});
const registry=new HotModuleRegistry({commandDir:path.resolve('commands'),utilDir:path.resolve('utils')}); await registry.loadAll(); registry.startWatching();
const inbox=new InboxStore(); const sessions=new NightSessionManager({roleManager});
sessions.on('message',message=>{if(!message.chatJid||!access.isAllowed(message.chatJid))return;inbox.upsertMessage(message);});
for(const sessionId of runtime.sessions)sessions.connect(sessionId).catch(error=>console.error(`[Night:${sessionId}] startup connection failed:`,error.message));
const server=createCortexServer({config,registry,roleManager,sessions,inbox,access}); server.listen(runtime.port,()=>console.log(`Night Core listening on :${runtime.port}`));
const shutdown=()=>{registry.stopWatching();server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref();}; process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
