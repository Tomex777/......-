export default {
  name:'poll',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({argsText,message,reply,features}){
    const parts=String(argsText||'').split('|').map(x=>x.trim()).filter(Boolean);if(parts.length<3)throw new Error('Use .poll Question | Option 1 | Option 2 [| Option 3...]');
    const [question,...options]=parts;await features.poll({sessionId:message.sessionId,chatJid:message.chatJid,question,options});return{question,options};
  }
};
