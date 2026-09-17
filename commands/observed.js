export default {
  name:'observed',aliases:[],ownerOnly:true,requiresAllowedChat:false,requiresAI:false,feature:'privacy',
  async execute({reply,features}){const rows=features.observed();if(!rows.length){await reply('No chats are in observer mode.');return{count:0};}await reply(rows.map(x=>`${x.label||x.jid} — ${x.jid}`).join('\n'));return{count:rows.length};}
};
