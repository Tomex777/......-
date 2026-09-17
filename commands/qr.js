export default {
  name:'qr',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({argsText,reply,features}){const text=String(argsText||'').trim();if(!text)throw new Error('Use .qr <text or URL>');const image=await features.qr(text);await reply({image,caption:text});return{bytes:image.length};}
};
