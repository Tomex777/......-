export default {
  name:'notes',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'notes',
  async execute({argsText,reply,features}){const rows=features.notes(String(argsText||'').trim());if(!rows.length){await reply('No notes found.');return{count:0};}await reply(rows.slice(0,30).map(x=>`#${x.id} ${String(x.title||x.body).slice(0,180)}`).join('\n'));return{count:rows.length};}
};
