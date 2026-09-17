export default {
  name:'hangman',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'games',
  async execute({argsText,message,reply,features}){const r=features.hangman(message.chatJid,String(argsText||'').trim());let text=`${r.shown}\nWrong: ${r.wrong}/${r.max}`;if(r.won)text+=`\nYou won: ${r.word}`;if(r.lost)text+=`\nYou lost: ${r.word}`;await reply(text);return r;}
};
