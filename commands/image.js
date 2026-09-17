export default {
  name:'image',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({argsText,reply,features}){const prompt=String(argsText||'').trim();if(!prompt)throw new Error('Use .image <prompt>');const image=await features.image(prompt);await reply({image,caption:prompt});return{bytes:image.length};}
};
