import { fetchPublicFile } from '../src/features/download.js';

export default {
  name:'download',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({argsText,reply}){const url=String(argsText||'').trim();if(!url)throw new Error('Use .download <public URL>');const f=await fetchPublicFile(url);if(f.mimetype.startsWith('image/'))await reply({image:f.buffer,caption:f.fileName});else if(f.mimetype.startsWith('video/'))await reply({video:f.buffer,caption:f.fileName});else if(f.mimetype.startsWith('audio/'))await reply({audio:f.buffer,mimetype:f.mimetype});else await reply({document:f.buffer,mimetype:f.mimetype,fileName:f.fileName});return{fileName:f.fileName,mimetype:f.mimetype,bytes:f.buffer.length};}
};
