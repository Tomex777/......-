export default {
  name:'searchmsg',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'groups',
  async execute({argsText,message,reply,features}){const q=String(argsText||'').trim();if(!q)throw new Error('Use .searchmsg <what you remember>');const r=await features.semanticMessageSearch({sessionId:message.sessionId,chatJid:message.chatJid,query:q});await reply(r||'No matching messages found.');return{query:q};}
};
