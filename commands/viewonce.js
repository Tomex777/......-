import { downloadQuotedMedia } from '../src/features/media.js';

export default {
  name:'viewonce',aliases:['vv'],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply}){
    const media=await downloadQuotedMedia(raw);
    if(media.kind==='image') await reply({image:media.buffer,caption:'View once opened'});
    else if(media.kind==='video') await reply({video:media.buffer,caption:'View once opened'});
    else if(media.kind==='audio') await reply({audio:media.buffer,mimetype:media.mimetype||'audio/ogg'});
    else throw new Error('Reply to a view-once image, video, or audio message.');
    return{kind:media.kind,bytes:media.buffer.length};
  }
};
