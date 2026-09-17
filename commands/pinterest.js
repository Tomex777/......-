export default {
  name:'pinterest',aliases:['pin'],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'content',
  async execute({argsText,reply,features}){const q=String(argsText||'').trim();if(!q)throw new Error('Use .pinterest <query>');const text=await features.pinterest(q);await reply(text);return{query:q};}
};
