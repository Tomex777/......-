import { quotedText } from '../src/features/media.js';

function firstUrl(text){const m=String(text||'').match(/https?:\/\/[^\s<>"']+/i);return m?.[0]?.replace(/[),.;!?]+$/,'')||null;}

export default {
  name:'download',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({argsText,raw,reply,features}){
    const url=firstUrl(String(argsText||'').trim())||firstUrl(quotedText(raw));
    if(!url)throw new Error('Use .download <public URL> or reply to a message containing a public URL.');
    const f=await features.download(url);
    if(f.mimetype.startsWith('image/'))await reply({image:f.buffer,caption:f.fileName});
    else if(f.mimetype.startsWith('video/'))await reply({video:f.buffer,caption:f.fileName});
    else if(f.mimetype.startsWith('audio/'))await reply({audio:f.buffer,mimetype:f.mimetype});
    else await reply({document:f.buffer,mimetype:f.mimetype,fileName:f.fileName});
    return{fileName:f.fileName,mimetype:f.mimetype,bytes:f.buffer.length,url};
  }
};
