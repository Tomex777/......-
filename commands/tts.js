import { quotedText } from '../src/features/media.js';

export default {
  name:'tts',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({argsText,raw,reply,features}){
    const text=String(argsText||'').trim()||quotedText(raw);
    if(!text) throw new Error('Use .tts <text> or reply to a text message with .tts');
    const audio=await features.tts(text);
    await reply({audio,mimetype:'audio/mpeg',ptt:false});
    return {bytes:audio.length,characters:text.length};
  }
};
