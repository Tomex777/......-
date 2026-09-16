import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { ConfigRegistry } from '../src/config/registry.js';
import { AccessController } from '../src/security/access.js';
import { SessionRoleManager } from '../src/whatsapp/roles.js';
import { PairingAttemptLock } from '../src/whatsapp/pairingLock.js';
import { PairingService } from '../src/whatsapp/pairingService.js';
import { normalizeMessage } from '../src/whatsapp/normalizeMessage.js';
import { HotModuleRegistry } from '../src/hotload/registry.js';

const temp=name=>fs.mkdtempSync(path.join(os.tmpdir(),`night-${name}-`));

test('config masks secrets and counts Groq key pool',()=>{
  const c=new ConfigRegistry({env:{GROQ_API_KEYS:'a,b,c',AZURE_CORE_KEY:'secret',PORT:'9000'}});
  const groq=c.publicEntry('GROQ_API_KEYS');const azure=c.publicEntry('AZURE_CORE_KEY');
  assert.equal(groq.configured,true);assert.equal(groq.count,3);assert.equal('value'in groq,false);
  assert.equal(azure.configured,true);assert.equal('value'in azure,false);assert.equal(c.runtime().port,9000);
});

test('environment is persistent config while hot values are runtime-only',()=>{
  const c=new ConfigRegistry({env:{WHATSAPP_ROLE_MODE:'split',PORT:'8787'}});
  assert.equal(c.publicEntry('WHATSAPP_ROLE_MODE').source,'environment');
  c.setRuntime('WHATSAPP_ROLE_MODE','main-all');
  assert.equal(c.get('WHATSAPP_ROLE_MODE'),'main-all');
  assert.equal(c.publicEntry('WHATSAPP_ROLE_MODE').source,'runtime');
  c.clearRuntime('WHATSAPP_ROLE_MODE');
  assert.equal(c.get('WHATSAPP_ROLE_MODE'),'split');
  assert.throws(()=>c.setRuntime('PORT',9999),/requires a deployment restart/);
});

test('disabled chat rejects owner except access bootstrap commands',()=>{
  const access=new AccessController({ownerNumber:'2348000000000'});
  assert.equal(access.canEnter({chatJid:'x@g.us',senderJid:'2348000000000@s.whatsapp.net'}).allowed,false);
  assert.equal(access.canEnter({chatJid:'x@g.us',senderJid:'2348000000000@s.whatsapp.net',commandName:'.allow'}).allowed,true);
  access.allow('x@g.us');assert.equal(access.canEnter({chatJid:'x@g.us',senderJid:'1@s.whatsapp.net'}).allowed,true);
});

test('session fallback is sticky until released',()=>{
  const r=new SessionRoleManager({sessions:['main','assistant'],mode:'split',inboxSession:'main',aiSession:'assistant',fallbackEnabled:true});
  r.markHealth('main',false);r.markHealth('assistant',true);assert.equal(r.resolve('inbox'),'assistant');
  r.markHealth('main',true);assert.equal(r.resolve('inbox'),'assistant');r.releaseFallback('inbox');assert.equal(r.resolve('inbox'),'main');
});

test('pairing lock prevents same-session code/QR collision',()=>{
  const l=new PairingAttemptLock();const main=l.claim('main','code');assert.ok(main);assert.equal(l.claim('main','qr'),null);
  const other=l.claim('assistant','qr');assert.ok(other);assert.equal(l.release('main','wrong'),false);assert.equal(l.release('main',main),true);
});

class FakeSessions extends EventEmitter {
  constructor(){super();this.records=new Map([['main',{registered:false,state:'idle'}],['assistant',{registered:false,state:'idle'}]]);this.codes=[];this.logouts=[];this.clears=[];}
  #r(id){return this.records.get(id);}
  isRegistered(id){return Boolean(this.#r(id)?.registered);}
  sessionSnapshot(id,{includeQr=false}={}){const r=this.#r(id);return{id,state:r?.state??'idle',registered:Boolean(r?.registered),lastError:null,...(includeQr?{qr:null}:{})};}
  async disconnect(id){this.#r(id).state='idle';}
  clearAuth(id){this.clears.push(id);this.#r(id).registered=false;this.#r(id).state='idle';}
  async logout(id){this.logouts.push(id);this.#r(id).registered=false;this.#r(id).state='idle';}
  async requestPairingCode(id,phone){this.#r(id).state='connecting';this.codes.push({id,phone});return `PAIR-${phone.slice(-4)}`;}
  async connect(id){this.#r(id).state='connecting';this.emit('qr',{sessionId:id,qr:'QR-DATA'});return{};}
}

test('new code request replaces an active pairing attempt',async()=>{
  const sessions=new FakeSessions();
  const pairing=new PairingService({sessions,allowedSessions:['main','assistant'],attemptTtlMs:60_000});
  const first=await pairing.startCode('main','2348011111111');
  assert.equal(first.code,'PAIR-1111');
  const second=await pairing.startCode('main','2348022222222');
  assert.equal(second.code,'PAIR-2222');
  assert.deepEqual(sessions.codes.map(x=>x.phone),['2348011111111','2348022222222']);
  assert.equal(pairing.snapshot('main').status,'waiting');
});

test('paired slot can be explicitly re-paired without restarting core',async()=>{
  const sessions=new FakeSessions();sessions.records.get('main').registered=true;sessions.records.get('main').state='open';
  const pairing=new PairingService({sessions,allowedSessions:['main','assistant'],attemptTtlMs:60_000});
  await assert.rejects(()=>pairing.startCode('main','2348033333333'),/already paired/);
  const result=await pairing.startCode('main','2348033333333',{replaceExisting:true});
  assert.equal(result.code,'PAIR-3333');assert.deepEqual(sessions.logouts,['main']);assert.equal(result.registered,false);
});

test('message normalizer preserves view-once wrapper',()=>{
  const n=normalizeMessage({key:{id:'1',remoteJid:'a@s.whatsapp.net'},messageTimestamp:10,message:{viewOnceMessageV2:{message:{imageMessage:{caption:'x',mimetype:'image/jpeg'}}}}});
  assert.equal(n.type,'imageMessage');assert.equal(n.viewOnce,true);assert.deepEqual(n.wrappers,['viewOnceV2']);assert.equal(n.text,'x');
});

test('hot loader keeps previous command when replacement is invalid',async()=>{
  const root=temp('hot');const commands=path.join(root,'commands');const utils=path.join(root,'utils');fs.mkdirSync(commands);fs.mkdirSync(utils);
  const file=path.join(commands,'ping.mjs');fs.writeFileSync(file,`export default {name:'ping',aliases:['p'],async execute(){return 'ok'}}`);
  const reg=new HotModuleRegistry({commandDir:commands,utilDir:utils});await reg.loadAll();assert.equal(await reg.resolveCommand('p').execute(),'ok');
  fs.writeFileSync(file,`export default {name:'ping'}`);assert.equal(await reg.reloadFile(file,'command'),false);assert.equal(await reg.resolveCommand('ping').execute(),'ok');
});
