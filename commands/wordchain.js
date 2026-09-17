export default {
  name:'wordchain',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'games',
  async execute({argsText,message,reply,features}){const r=features.wordchain(message.chatJid,String(argsText||'').trim());await reply(r.message||`Accepted: ${r.last}. Next word must start with “${r.next}”. Used: ${r.count}`);return r;}
};
