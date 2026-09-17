function extractJson(text){const s=String(text||'');const fenced=s.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||s;const a=fenced.indexOf('{'),b=fenced.lastIndexOf('}');if(a<0||b<a)return null;try{return JSON.parse(fenced.slice(a,b+1));}catch{return null;}}
const replaceLast=(value,last)=>typeof value==='string'?value.replaceAll('$last',typeof last==='string'?last:JSON.stringify(last)):value;

export class NightAgent {
  constructor({ai,features,logger=console}={}){this.ai=ai;this.features=features;this.logger=logger;}

  async run({request,sessionId,chatJid,senderJid,raw=null}={}){
    const catalog=`Allowed actions: search(query), summarize(text), translate(text), note(text), todo(text), reminder(text), anime(mode,query), manga(mode,query), meme(dark), qr(text), image(prompt), table(title,columns,rows), save(text), answer(text). Use $last in a later string argument to reference the previous action output. Maximum 6 actions. Never invent an action outside this list.`;
    const planResult=await this.ai.ask({text:`Plan this request as JSON only: ${request}\n\n${catalog}\nShape: {"actions":[{"type":"search","query":"..."}]}`,sessionId,chatJid:`agent-plan:${chatJid}`,senderJid,remember:false,complexity:.65});
    const plan=extractJson(planResult.text);const actions=Array.isArray(plan?.actions)?plan.actions.slice(0,6):null;if(!actions?.length)throw new Error('Night could not form a safe workflow plan.');
    let last='';const trace=[];
    for(const action of actions){const type=String(action?.type||'').toLowerCase();let out;
      if(type==='search') out=(await this.ai.search({text:replaceLast(action.query,last),sessionId,chatJid,senderJid})).text;
      else if(type==='summarize') out=(await this.ai.summarize({text:replaceLast(action.text,last),sessionId,chatJid,senderJid})).text;
      else if(type==='translate') out=(await this.ai.translate({text:replaceLast(action.text,last),sessionId,chatJid,senderJid})).text;
      else if(type==='note'){const id=this.features.noteAdd(replaceLast(action.text,last));out=`Note #${id} saved.`;}
      else if(type==='todo'){const id=this.features.todoAdd(replaceLast(action.text,last));out=`Todo #${id} added.`;}
      else if(type==='reminder'){const r=await this.features.reminder({text:replaceLast(action.text,last),sessionId,chatJid});out=`Reminder #${r.id} set for ${new Date(r.dueAt).toLocaleString('en-NG')}.`;}
      else if(type==='anime'){const rows=await this.features.anime(action.mode||'trending',replaceLast(action.query||'',last));out=rows;}
      else if(type==='manga'){const rows=await this.features.manga(action.mode||'trending',replaceLast(action.query||'',last));out=rows;}
      else if(type==='meme'){const rows=await this.features.memes(Boolean(action.dark));out=rows[0]||'No meme found.';}
      else if(type==='qr') out={kind:'image',buffer:await this.features.qr(replaceLast(action.text,last)),caption:replaceLast(action.text,last)};
      else if(type==='image') out={kind:'image',buffer:await this.features.image(replaceLast(action.prompt,last)),caption:replaceLast(action.prompt,last)};
      else if(type==='table') out={kind:'image',buffer:await this.features.table({title:action.title||'Night',columns:action.columns||[],rows:action.rows||[]}),caption:action.title||'Night'};
      else if(type==='save'){const id=this.features.saveText({text:replaceLast(action.text,last),chatJid});out=`Saved as #${id.id}.`;}
      else if(type==='answer') out=replaceLast(action.text,last);
      else throw new Error(`Workflow action not allowed: ${type}`);
      trace.push({type});last=out;
    }
    return{output:last,trace,planProvider:planResult.provider,planModel:planResult.model};
  }
}
