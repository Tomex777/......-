export default {
  name:'tts',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({argsText,reply,features}){
    const text=String(argsText||'').trim(); if(!text) throw new Error('Use .tts <text>');
    const audio=await features.tts(text); await reply({audio,mimetype:'audio/mpeg',ptt:false}); return {bytes:audio.length};
  }
};
