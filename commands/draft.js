import { quotedText } from '../src/features/media.js';
export default {
  name:'draft',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'ai',
  async execute({argsText,raw,message,senderJid,reply,ai}){const source=quotedText(raw);const tone=String(argsText||'').trim()||'natural and concise';if(!source)throw new Error('Reply to a message with .draft [tone/instruction]');const r=await ai.ask({text:`Draft a WhatsApp reply to this message. Tone/instruction: ${tone}. Return only the suggested reply.\n\nMessage:\n${source}`,sessionId:message.sessionId,chatJid:message.chatJid,senderJid,remember:false,complexity:.35});await reply(r.text);return{provider:r.provider,model:r.model};}
};
