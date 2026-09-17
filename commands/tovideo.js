export default {
  name:'tovideo',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply,features}){const video=await features.toVideo(raw);await reply({video,mimetype:'video/mp4'});return{bytes:video.length};}
};
