function menuPayload(){
  return {
    text:'Games\nChoose a game below.',
    footer:'Night',
    buttons:[
      { text:'Chess', id:'.chess new' },
      { text:'Trivia', id:'.trivia new' },
      {
        text:'More games',
        sections:[{
          title:'Games',
          rows:[
            { header:'', title:'Tic-tac-toe', description:'Start a new board', id:'.tictactoe new' },
            { header:'', title:'Hangman', description:'Guess the word', id:'.hangman new' },
            { header:'', title:'Word chain', description:'Continue from the last letter', id:'.wordchain new' },
            { header:'', title:'Would you rather', description:'Pick between two choices', id:'.wouldyourather' }
          ]
        }]
      }
    ]
  };
}

export default {
  name:'games',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'games',
  async execute({reply}){
    await reply(menuPayload());
    return{menu:true,interactive:true};
  }
};
