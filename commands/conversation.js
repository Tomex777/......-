export default {
  name:'conversation',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'history',
  async execute({args,message,reply,features,ai}){
    const n=Math.max(10,Math.min(Number(args?.[0])||100,500));const rows=features.inbox.listMessages(message.sessionId,message.chatJid,n).filter(x=>x.text);if(!rows.length)throw new Error('No stored conversation text is available.');
    const transcript=rows.map(x=>`[${new Date(x.timestamp).toLocaleString('en-NG')}] ${x.pushName||x.participantJid||x.senderJid||'Someone'}: ${x.text}`).join('\n');
    const summary=await ai.ask({text:`Turn this WhatsApp conversation into clean meeting-style notes with summary, decisions, action items, important facts and open questions. Do not invent facts.\n\n${transcript}`,sessionId:message.sessionId,chatJid:`conversation:${message.chatJid}`,remember:false,complexity:.5});
    const pdf=await features.pdf({title:'Night Conversation Report',lines:summary.text.split('\n')});await reply({document:pdf,mimetype:'application/pdf',fileName:'Night-conversation.pdf'});return{messages:rows.length,provider:summary.provider,model:summary.model,bytes:pdf.length};
  }
};
