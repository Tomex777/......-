export default {
  name:'scanqr',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({raw,reply,features}){
    const text=await features.scanQr(raw);
    await reply(text);
    return{text};
  }
};
