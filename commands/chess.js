function text(r){return [r.move?`Move: ${r.move.san}`:null,r.checkmate?'Checkmate.':r.draw?'Draw.':r.gameOver?'Game over.':`Turn: ${r.turn==='w'?'White':'Black'}`,r.ascii||''].filter(Boolean).join('\n\n');}
export default {
  name:'chess',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'games',
  async execute({argsText,message,reply,features}){const r=features.chess(message.chatJid,String(argsText||'').trim());await reply(text(r));return r;}
};
