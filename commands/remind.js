export default {
  name:'remind',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'reminders',
  async execute({argsText,message,reply,features}){const r=await features.reminder({text:argsText,sessionId:message.sessionId,chatJid:message.chatJid});await reply(`Reminder #${r.id} set for ${new Date(r.dueAt).toLocaleString('en-NG')}: ${r.text}`);return r;}
};
