import fs from 'node:fs';
import path from 'node:path';
import { quotedText, downloadQuotedMedia } from '../src/features/media.js';

export default {
  name:'save',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({argsText,raw,message,reply,features}){
    const typed=String(argsText||'').trim();const text=typed||quotedText(raw);
    if(text){const r=features.saveText({text,chatJid:message.chatJid,messageId:message.id});await reply(`Saved as #${r.id}.`);return r;}
    try{
      const media=await downloadQuotedMedia(raw);const dir=path.resolve('data/library');fs.mkdirSync(dir,{recursive:true,mode:0o700});
      const ext=media.kind==='image'?'.img':media.kind==='video'?'.vid':media.kind==='audio'?'.aud':media.kind==='sticker'?'.webp':'.bin';
      const filePath=path.join(dir,`${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);fs.writeFileSync(filePath,media.buffer,{mode:0o600});
      const id=features.store.addLibrary({kind:media.kind,title:media.fileName||null,filePath,chatJid:message.chatJid,messageId:message.id,metadata:{mimetype:media.mimetype,size:media.buffer.length}});
      await reply(`Saved ${media.kind} as #${id}.`);return{id,kind:media.kind,bytes:media.buffer.length};
    }catch(error){throw new Error('Add text after .save or reply to text/media you want stored.');}
  }
};
