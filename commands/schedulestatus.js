import fs from 'node:fs';
import path from 'node:path';
import { downloadQuotedMedia } from '../src/features/media.js';

export default {
  name:'schedulestatus',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'whatsapp',
  async execute({argsText,raw,message,reply,features}){
    const p=features.parseWhen(argsText);if(!p)throw new Error('Use .schedulestatus in 30 minutes [caption], optionally replying to an image/video.');
    let action='status-text',payload={text:p.rest||''};
    try{
      const media=await downloadQuotedMedia(raw);
      if(['image','video'].includes(media.kind)){
        const dir=path.resolve('data/scheduled-media');fs.mkdirSync(dir,{recursive:true,mode:0o700});
        const ext=media.kind==='image'?'.img':'.vid';const filePath=path.join(dir,`${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);fs.writeFileSync(filePath,media.buffer,{mode:0o600});
        action=`status-${media.kind}`;payload={text:p.rest||'',filePath,mimetype:media.mimetype||null};
      }
    }catch(error){if(!p.rest)throw new Error('Add status text after the time or reply to an image/video.');}
    const id=features.store.addScheduledAction({dueAt:p.at,sessionId:message.sessionId,chatJid:message.chatJid,action,payload});
    await reply(`Scheduled status #${id} for ${new Date(p.at).toLocaleString('en-NG')}.`);return{id,dueAt:p.at,action};
  }
};
