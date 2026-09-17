export default {
  name:'toimg',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply,features}){const image=await features.toImage(raw);await reply({image,caption:'Converted from sticker'});return{bytes:image.length};}
};
