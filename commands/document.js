export default {
  name:'document',aliases:['doc'],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'media',
  async execute({argsText,raw,message,senderJid,reply,ai,features}){
    const doc=await features.readDocument(raw); if(!doc.text) throw new Error('No readable text was found in that document.');
    const instruction=String(argsText||'').trim()||'Summarize this document, then list important facts, dates, decisions and action items.';
    const r=await ai.ask({text:`${instruction}\n\nDocument (${doc.fileName||doc.kind}):\n${doc.text.slice(0,45000)}`,sessionId:message.sessionId,chatJid:message.chatJid,senderJid,remember:false,complexity:.55});
    await reply(r.text);return{kind:doc.kind,pages:doc.pages,characters:doc.text.length,provider:r.provider,model:r.model};
  }
};
