export default {
  name:'sticker',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply,features}){const sticker=await features.sticker(raw);await reply({sticker});return{bytes:sticker.length};}
};
