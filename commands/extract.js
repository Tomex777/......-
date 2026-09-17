import { quotedText } from '../src/features/media.js';
export default {
  name:'extract',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'ai',
  async execute({argsText,raw,message,senderJid,reply,ai}){const text=String(argsText||'').trim()||quotedText(raw);if(!text)throw new Error('Add text or reply to a message with .extract');const r=await ai.ask({text:`Extract action items, deadlines, decisions, names, numbers and follow-ups from this text. Be concise and do not invent anything.\n\n${text}`,sessionId:message.sessionId,chatJid:message.chatJid,senderJid,remember:false,complexity:.35});await reply(r.text);return{provider:r.provider,model:r.model};}
};
