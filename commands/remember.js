export default {
  name:'remember',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'notes',
  async execute({argsText,message,reply,features}){const text=String(argsText||'').trim();if(!text)throw new Error('Use .remember <fact>, or .remember Person | fact');const parts=text.split('|').map(x=>x.trim());const title=parts.length>1?parts.shift():null;const fact=parts.length?parts.join(' | '):text;const id=features.store.addLibrary({kind:'memory',title,text:fact,chatJid:message.chatJid,messageId:message.id});await reply(`Remembered as #${id}${title?` for ${title}`:''}.`);return{id,title};}
};
