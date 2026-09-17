export default {
  name:'compress',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply,features}){const image=await features.compress(raw);await reply({image,caption:'Compressed'});return{bytes:image.length};}
};
