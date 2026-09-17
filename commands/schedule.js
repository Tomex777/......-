export default {
  name:'schedule',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({argsText,message,reply,features}){
    const p=features.parseWhen(argsText);if(!p||!p.rest)throw new Error('Use .schedule in 30 minutes <message>');
    const id=features.store.addScheduledAction({dueAt:p.at,sessionId:message.sessionId,chatJid:message.chatJid,action:'message',payload:{text:p.rest}});
    await reply(`Scheduled message #${id} for ${new Date(p.at).toLocaleString('en-NG')}.`);return{id,dueAt:p.at};
  }
};
