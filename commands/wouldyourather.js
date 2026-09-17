export default {
  name:'wouldyourather',aliases:['wyr'],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'games',
  async execute({reply,features}){const r=features.wouldYouRather();await reply(`Would you rather…\n\nA. ${r.a}\n\nB. ${r.b}`);return r;}
};
