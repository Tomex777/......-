export default {
  name:'memory',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'notes',
  async execute({argsText,reply,features}){const q=String(argsText||'').trim();const rows=q?features.libraryFind(q,50):features.libraryRecent(100).filter(x=>x.kind==='memory');const memories=rows.filter(x=>x.kind==='memory');if(!memories.length){await reply('No matching private memories.');return{count:0};}await reply(memories.slice(0,30).map(x=>`#${x.id}${x.title?` ${x.title}:`:''} ${x.text||''}`).join('\n'));return{count:memories.length};}
};
