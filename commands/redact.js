export default {
  name:'redact',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({args,raw,reply,features}){const [left=0,top=0,width=100,height=100]=args.map(Number);const image=await features.redact(raw,{left,top,width,height});await reply({image,caption:'Redacted'});return{left,top,width,height,bytes:image.length};}
};
