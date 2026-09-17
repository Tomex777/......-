export default {
  name:'resize',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({args,raw,reply,features}){const width=Math.max(64,Math.min(Number(args?.[0])||1080,4096));const image=await features.resize(raw,width);await reply({image,caption:`Resized to max ${width}px`});return{bytes:image.length,width};}
};
