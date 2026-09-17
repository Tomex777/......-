import fs from 'node:fs';
import { animeList, mangaList } from './content.js';

export class FeatureScheduler {
  constructor({ store, sessions, ai, logger=console, actionIntervalMs=15000, watchIntervalMs=30*60*1000 }={}) {
    this.store=store; this.sessions=sessions; this.ai=ai; this.logger=logger;
    this.actionTimer=setInterval(()=>this.tickActions().catch(e=>this.logger.warn?.({err:e.message},'scheduled action tick failed')),actionIntervalMs);
    this.watchTimer=setInterval(()=>this.tickWatches().catch(e=>this.logger.warn?.({err:e.message},'watch tick failed')),watchIntervalMs);
    this.actionTimer.unref?.(); this.watchTimer.unref?.();
  }
  close(){clearInterval(this.actionTimer);clearInterval(this.watchTimer);}

  async tickActions(now=Date.now()){
    for(const row of this.store.dueScheduledActions(now,100)){
      try{
        if(row.action==='message') await this.sessions.sendViaSession(row.session_id,row.chat_jid,{text:String(row.payload?.text||'')});
        else if(row.action==='status-text') await this.sessions.sendViaSession(row.session_id,'status@broadcast',{text:String(row.payload?.text||'')});
        else if(row.action==='status-image'){
          const buffer=fs.readFileSync(row.payload.filePath);await this.sessions.sendViaSession(row.session_id,'status@broadcast',{image:buffer,caption:String(row.payload?.text||'')});
          fs.rmSync(row.payload.filePath,{force:true});
        }else if(row.action==='status-video'){
          const buffer=fs.readFileSync(row.payload.filePath);await this.sessions.sendViaSession(row.session_id,'status@broadcast',{video:buffer,caption:String(row.payload?.text||''),mimetype:row.payload?.mimetype||'video/mp4'});
          fs.rmSync(row.payload.filePath,{force:true});
        }else throw new Error(`Unsupported scheduled action ${row.action}`);
        this.store.markScheduledActionFired(row.id,now);
      }catch(error){this.logger.warn?.({id:row.id,action:row.action,err:error.message},'scheduled action failed');}
    }
  }

  async tickWatches(now=Date.now()){
    for(const watch of this.store.listWatches(100)){
      try{
        const current=await this.#resolveWatch(watch);
        if(current==null){this.store.updateWatch(watch.id,{lastValue:watch.last_value,lastCheckedAt:now});continue;}
        if(watch.last_value!=null && current!==watch.last_value){await this.sessions.sendViaSession(watch.session_id,watch.chat_jid,{text:`Watch update: ${watch.query}\n\n${current}`});}
        this.store.updateWatch(watch.id,{lastValue:current,lastCheckedAt:now});
      }catch(error){this.logger.warn?.({watchId:watch.id,err:error.message},'watch check failed');}
    }
  }

  async #resolveWatch(watch){
    if(watch.kind==='anime'){const rows=await animeList('search',watch.query); const x=rows[0]; if(!x)return null; return JSON.stringify({title:x.title,status:x.status,episodes:x.episodes,score:x.score});}
    if(watch.kind==='manga'){const rows=await mangaList('search',watch.query); const x=rows[0]; if(!x)return null; return JSON.stringify({title:x.title,status:x.status,chapters:x.chapters,score:x.score});}
    if(watch.kind==='web'){const r=await this.ai.search({text:`Check the current state of: ${watch.query}. Return a compact factual state summary only.`,sessionId:'watch',chatJid:`watch:${watch.id}`});return String(r.text||'').trim()||null;}
    return null;
  }
}
