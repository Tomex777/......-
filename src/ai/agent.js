function extractJson(text){
  const s=String(text||'');
  const fenced=s.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||s;
  const a=fenced.indexOf('{'),b=fenced.lastIndexOf('}');
  if(a<0||b<a)return null;
  try{return JSON.parse(fenced.slice(a,b+1));}catch{return null;}
}

const replaceLast=(value,last)=>typeof value==='string'
  ? value.replaceAll('$last',typeof last==='string'?last:JSON.stringify(last))
  : value;

function listText(rows=[]){
  return rows.map((x,i)=>`${i+1}. ${x.title||x.text||x.name||JSON.stringify(x)}${x.url?`\n${x.url}`:''}`).join('\n\n');
}

function chessText(r){
  return [
    r.move?`Move: ${r.move.san}`:null,
    r.checkmate?'Checkmate.':r.draw?'Draw.':r.gameOver?'Game over.':`Turn: ${r.turn==='w'?'White':'Black'}`,
    r.ascii||''
  ].filter(Boolean).join('\n\n');
}

function fileOutput(file={}){
  const mimetype=String(file.mimetype||'application/octet-stream');
  if(file.kind==='sticker')return{kind:'sticker',buffer:file.buffer};
  if(file.kind==='image'||mimetype.startsWith('image/'))return{kind:'image',buffer:file.buffer,caption:file.fileName||''};
  if(file.kind==='video'||mimetype.startsWith('video/'))return{kind:'video',buffer:file.buffer,mimetype:mimetype||'video/mp4',caption:file.fileName||''};
  if(file.kind==='audio'||mimetype.startsWith('audio/'))return{kind:'audio',buffer:file.buffer,mimetype,ptt:false};
  return{kind:'document',buffer:file.buffer,mimetype,fileName:file.fileName||'Night-file'};
}

export class NightAgent {
  constructor({ai,features,logger=console}={}){this.ai=ai;this.features=features;this.logger=logger;}

  async run({request,sessionId,chatJid,senderJid,raw=null}={}){
    const catalog=`Allowed actions: search(query), summarize(text), translate(text), transcribe(), vision(), sticker(), sticker_to_image(), compress_image(), resize_image(width), to_video(), tts(text), read_document(instruction), scan_qr(), view_once(), download(url), note(text), todo(text), reminder(text), poll(question,options), anime(mode,query), manga(mode,query), meme(dark), pinterest(query), gif(query), qr(text), image(prompt), table(title,columns,rows,format), save(text), find_saved(query), recent_saved(), status(text), chess(move), trivia(answer), hangman(letter), wordchain(word), would_you_rather(), answer(text). Use $last in a later string argument to reference the previous action output. Replied-media actions operate on the replied WhatsApp message. read_document supports replied PDF, DOCX and text documents. scan_qr reads a QR from a replied image. view_once opens replied view-once media. download accepts only a public http/https URL. table format is image by default and pdf only when explicitly requested. poll options must contain at least two items. Maximum 6 actions. Never invent an action outside this list.`;
    const planResult=await this.ai.ask({
      text:`Plan this request as JSON only: ${request}\n\n${catalog}\nShape: {"actions":[{"type":"search","query":"..."}]}`,
      sessionId,
      chatJid:`agent-plan:${chatJid}`,
      senderJid,
      remember:false,
      complexity:.65
    });
    const plan=extractJson(planResult.text);
    const actions=Array.isArray(plan?.actions)?plan.actions.slice(0,6):null;
    if(!actions?.length)throw new Error('Night could not form a safe workflow plan.');

    let last='';
    const trace=[];
    for(const action of actions){
      const type=String(action?.type||'').toLowerCase();
      let out;
      if(type==='search') out=(await this.ai.search({text:replaceLast(action.query,last),sessionId,chatJid,senderJid})).text;
      else if(type==='summarize') out=(await this.ai.summarize({text:replaceLast(action.text,last),sessionId,chatJid,senderJid})).text;
      else if(type==='translate') out=(await this.ai.translate({text:replaceLast(action.text,last),sessionId,chatJid,senderJid})).text;
      else if(type==='transcribe') out=(await this.features.transcribe(raw)).text;
      else if(type==='vision'){
        const r=await this.features.vision(raw);
        out=[r.caption,r.text,r.tags?.length?`Tags: ${r.tags.join(', ')}`:''].filter(Boolean).join('\n');
      }
      else if(type==='sticker') out={kind:'sticker',buffer:await this.features.sticker(raw)};
      else if(type==='sticker_to_image') out={kind:'image',buffer:await this.features.toImage(raw),caption:''};
      else if(type==='compress_image') out={kind:'image',buffer:await this.features.compress(raw),caption:'Compressed'};
      else if(type==='resize_image'){
        const width=Math.max(64,Math.min(Number(action.width)||1024,4096));
        out={kind:'image',buffer:await this.features.resize(raw,width),caption:`Resized to ${width}px wide`};
      }
      else if(type==='to_video') out={kind:'video',buffer:await this.features.toVideo(raw),mimetype:'video/mp4',caption:''};
      else if(type==='tts') out={kind:'audio',buffer:await this.features.tts(replaceLast(action.text,last)),mimetype:'audio/mpeg',ptt:false};
      else if(type==='read_document'){
        const doc=await this.features.readDocument(raw);
        if(!doc?.text)throw new Error('No readable text was found in that document.');
        const instruction=replaceLast(action.instruction||'Summarize this document and preserve important facts, dates, decisions and action items.',last);
        const r=await this.ai.ask({
          text:`${instruction}\n\nDocument (${doc.fileName||doc.kind||'file'}):\n${String(doc.text).slice(0,45000)}`,
          sessionId,chatJid,senderJid,remember:false,complexity:.55
        });
        out=r.text;
      }
      else if(type==='scan_qr') out=await this.features.scanQr(raw);
      else if(type==='view_once') out=fileOutput(await this.features.openViewOnce(raw));
      else if(type==='download'){
        const url=replaceLast(action.url||'',last);
        if(!/^https?:\/\//i.test(url))throw new Error('A public http/https URL is required to download a file.');
        out=fileOutput(await this.features.download(url));
      }
      else if(type==='note'){
        const id=this.features.noteAdd(replaceLast(action.text,last));
        out=`Note #${id} saved.`;
      }
      else if(type==='todo'){
        const id=this.features.todoAdd(replaceLast(action.text,last));
        out=`Todo #${id} added.`;
      }
      else if(type==='reminder'){
        const r=await this.features.reminder({text:replaceLast(action.text,last),sessionId,chatJid});
        out=`Reminder #${r.id} set for ${new Date(r.dueAt).toLocaleString('en-NG')}.`;
      }
      else if(type==='poll'){
        const question=replaceLast(action.question||'',last);
        const options=Array.isArray(action.options)?action.options.map(x=>replaceLast(String(x),last)).filter(Boolean):[];
        if(!question||options.length<2)throw new Error('A poll needs a question and at least two options.');
        await this.features.poll({sessionId,chatJid,question,options,selectableCount:Number(action.selectableCount)||1});
        out='Poll created.';
      }
      else if(type==='anime'){
        const rows=await this.features.anime(action.mode||'trending',replaceLast(action.query||'',last));
        out=listText(rows);
      }
      else if(type==='manga'){
        const rows=await this.features.manga(action.mode||'trending',replaceLast(action.query||'',last));
        out=listText(rows);
      }
      else if(type==='meme'){
        const rows=await this.features.memes(Boolean(action.dark));
        const x=rows[0];
        out=x?{kind:'image-url',url:x.url,caption:x.title||''}:'No meme found.';
      }
      else if(type==='pinterest') out=await this.features.pinterest(replaceLast(action.query,last));
      else if(type==='gif'){
        const rows=await this.features.gifs(replaceLast(action.query,last));
        const x=rows[0];
        out=x?{kind:'gif',url:x.url,caption:x.title||String(action.query||'')}:'No GIF found.';
      }
      else if(type==='qr'){
        const text=replaceLast(action.text,last);
        out={kind:'image',buffer:await this.features.qr(text),caption:text};
      }
      else if(type==='image'){
        const prompt=replaceLast(action.prompt,last);
        out={kind:'image',buffer:await this.features.image(prompt),caption:prompt};
      }
      else if(type==='table'){
        const spec={title:action.title||'Night',columns:action.columns||[],rows:action.rows||[]};
        if(String(action.format||'image').toLowerCase()==='pdf'){
          out={kind:'document',buffer:await this.features.tablePdf(spec),mimetype:'application/pdf',fileName:'Night-table.pdf'};
        }else{
          out={kind:'image',buffer:await this.features.table(spec),caption:action.title||'Night'};
        }
      }
      else if(type==='save'){
        const saved=this.features.saveText({text:replaceLast(action.text,last),chatJid});
        out=`Saved as #${saved.id}.`;
      }
      else if(type==='find_saved'){
        const rows=this.features.libraryFind(replaceLast(action.query,last),25);
        out=rows.length?rows.map(x=>`#${x.id} ${x.title||x.text||x.kind}`).join('\n'):'Nothing saved matched that.';
      }
      else if(type==='recent_saved'){
        const rows=this.features.libraryRecent(25);
        out=rows.length?rows.map(x=>`#${x.id} ${x.title||x.text||x.kind}`).join('\n'):'Nothing has been saved yet.';
      }
      else if(type==='status'){
        await this.features.postStatus({sessionId,text:replaceLast(action.text||'',last)||null,raw});
        out='Status posted.';
      }
      else if(type==='chess') out=chessText(this.features.chess(chatJid,replaceLast(action.move||'',last)));
      else if(type==='trivia'){
        const r=this.features.trivia(chatJid,replaceLast(action.answer||'',last));
        out=r.question?`Trivia: ${r.question}`:(r.correct?'Correct.':`Not quite. Answer: ${r.answer}`);
      }
      else if(type==='hangman'){
        const r=this.features.hangman(chatJid,replaceLast(action.letter||'',last));
        out=[r.shown,`${r.wrong}/${r.max} wrong`,r.won?'You won.':r.lost?`Game over. Word: ${r.word}`:null].filter(Boolean).join('\n');
      }
      else if(type==='wordchain'){
        const r=this.features.wordchain(chatJid,replaceLast(action.word||'',last));
        out=r.message||`${r.last} — next word starts with “${r.next}”.`;
      }
      else if(type==='would_you_rather'){
        const r=this.features.wouldYouRather();
        out=`Would you rather…\n1. ${r.a}\n2. ${r.b}`;
      }
      else if(type==='answer') out=replaceLast(action.text,last);
      else throw new Error(`Workflow action not allowed: ${type}`);
      trace.push({type});
      last=out;
    }
    return{output:last,trace,planProvider:planResult.provider,planModel:planResult.model};
  }
}
