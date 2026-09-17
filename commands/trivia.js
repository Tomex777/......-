export default {
  name:'trivia',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'games',
  async execute({argsText,message,reply,features}){const r=features.trivia(message.chatJid,String(argsText||'').trim());if(r.question&&!Object.hasOwn(r,'correct'))await reply(`Trivia\n\n${r.question}`);else await reply(`${r.correct?'Correct.':'Not quite.'}\nAnswer: ${r.answer}`);return r;}
};
