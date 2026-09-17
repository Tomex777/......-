export default {
  name:'schedulestatus',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'whatsapp',
  async execute({argsText,message,reply,features}){
    const p=features.parseWhen(argsText);if(!p||!p.rest)throw new Error('Use .schedulestatus in 30 minutes <status text>');
    const id=features.store.addScheduledAction({dueAt:p.at,sessionId:message.sessionId,chatJid:message.chatJid,action:'status-text',payload:{text:p.rest}});
    await reply(`Scheduled status #${id} for ${new Date(p.at).toLocaleString('en-NG')}.`);return{id,dueAt:p.at};
  }
};
