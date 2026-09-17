export default {
  name:'weather',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'utility',
  async execute({argsText,message,senderJid,reply,ai}){const place=String(argsText||'').trim();if(!place)throw new Error('Use .weather <city/place>');const r=await ai.search({text:`Give the current weather and short forecast for ${place}. Include temperature, conditions, rain chance if available, and source-aware current information.`,sessionId:message.sessionId,chatJid:message.chatJid,senderJid});await reply(r.text);return{provider:r.provider,model:r.model};}
};
