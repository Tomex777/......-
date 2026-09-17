export default {
  name:'media',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'content',
  async execute({argsText,message,senderJid,reply,ai}){const q=String(argsText||'').trim();if(!q)throw new Error('Use .media <what you want>');const r=await ai.search({text:`Find useful public media for this request: ${q}. Prefer direct, reputable source pages and clearly label image/video/GIF results. Do not invent links.`,sessionId:message.sessionId,chatJid:message.chatJid,senderJid});await reply(r.text);return{provider:r.provider,model:r.model};}
};
