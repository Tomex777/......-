export default {
  name:'time',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'utility',
  async execute({argsText,message,senderJid,reply,ai}){const place=String(argsText||'').trim();if(!place){await reply(new Date().toLocaleString('en-NG'));return{local:true};}const r=await ai.search({text:`What is the current local time in ${place}? Return the place, date, time and timezone concisely.`,sessionId:message.sessionId,chatJid:message.chatJid,senderJid});await reply(r.text);return{provider:r.provider,model:r.model};}
};
