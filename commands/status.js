export default {
  name:'status',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'whatsapp',
  async execute({argsText,raw,message,reply,features}){
    await features.postStatus({sessionId:message.sessionId,text:String(argsText||'').trim()||null,raw});
    await reply('Status posted.');
    return{posted:true};
  }
};
