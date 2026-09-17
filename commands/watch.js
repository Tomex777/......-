export default {
  name:'watch',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({args,argsText,message,reply,features}){
    const kind=String(args?.[0]||'').toLowerCase();if(!['anime','manga','web'].includes(kind))throw new Error('Use .watch anime <title>, .watch manga <title>, or .watch web <query>');
    const query=argsText.slice(argsText.toLowerCase().indexOf(kind)+kind.length).trim();if(!query)throw new Error(`Use .watch ${kind} <query>`);
    const id=features.store.addWatch({kind,query,sessionId:message.sessionId,chatJid:message.chatJid});await reply(`Watch #${id} enabled for ${kind}: ${query}`);return{id,kind,query};
  }
};
