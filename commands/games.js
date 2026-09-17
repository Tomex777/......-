export default {
  name:'games',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'games',
  async execute({reply}){await reply(['Games','','.chess [new | move]','.trivia [new | answer]','.hangman [new | letter]','.wordchain [new | word]','.wouldyourather'].join('\n'));return{menu:true};}
};
