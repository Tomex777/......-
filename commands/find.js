export default {
  name:'find',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({argsText,message,senderJid,reply,features,ai,config}){
    const q=String(argsText||'').trim();if(!q)throw new Error('Use .find <query>');
    let rows=features.libraryFind(q,25);
    if(rows.length){await reply(rows.map(x=>`#${x.id} ${x.kind} — ${String(x.title||x.text||x.url||'').slice(0,160)}`).join('\n'));return{count:rows.length,semantic:false};}
    const recent=features.libraryRecent(200);
    if(!recent.length||!config.get('AI_ENABLED',true)){await reply('Nothing found.');return{count:0};}
    const corpus=recent.map(x=>`#${x.id} [${x.kind}] ${String(x.title||x.text||x.url||'').slice(0,800)}`).join('\n');
    const r=await ai.ask({text:`Find the saved items most semantically relevant to: ${q}\nReturn only matching #IDs with a one-line reason, or "Nothing found".\n\n${corpus}`,sessionId:message.sessionId,chatJid:`library-find:${message.chatJid}`,senderJid,remember:false,complexity:.35});
    await reply(r.text);return{count:null,semantic:true,provider:r.provider,model:r.model};
  }
};
