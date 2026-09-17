export default {
  name:'observe',aliases:[],ownerOnly:true,requiresAllowedChat:false,requiresAI:false,feature:'privacy',
  async execute({message,reply,features,sessions}){const label=await sessions.describeChat(message.sessionId,message.chatJid).catch(()=>null);features.observe(message.chatJid,label);await reply('Observer mode enabled for this chat. Night will store it privately for your catch-ups/search, but this does not enable normal Night replies here.');return{observed:true,jid:message.chatJid,label};}
};
