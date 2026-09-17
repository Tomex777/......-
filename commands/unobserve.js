export default {
  name:'unobserve',aliases:[],ownerOnly:true,requiresAllowedChat:false,requiresAI:false,feature:'privacy',
  async execute({message,reply,features}){const ok=features.unobserve(message.chatJid);await reply(ok?'Observer mode disabled for this chat.':'This chat was not in observer mode.');return{observed:false,changed:ok};}
};
