export default {
  name:'recent',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({reply,features}){const rows=features.libraryRecent(25);if(!rows.length){await reply('Nothing saved yet.');return{count:0};}await reply(rows.map(x=>`#${x.id} ${x.kind} — ${String(x.title||x.text||x.url||'').slice(0,160)}`).join('\n'));return{count:rows.length};}
};
