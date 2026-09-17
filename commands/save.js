import { quotedText } from '../src/features/media.js';

export default {
  name:'save',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({argsText,raw,message,reply,features}){
    const text=String(argsText||'').trim()||quotedText(raw)||String(message.text||'').replace(/^\.save\s*/i,'').trim();
    if(!text)throw new Error('Add text after .save or reply to a text message.');
    const r=features.saveText({text,chatJid:message.chatJid,messageId:message.id});
    await reply(`Saved as #${r.id}.`);return r;
  }
};
