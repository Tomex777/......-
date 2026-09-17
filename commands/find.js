export default {
  name:'find',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({argsText,reply,features}){
    const q=String(argsText||'').trim();if(!q)throw new Error('Use .find <query>');
    const rows=features.libraryFind(q,25);if(!rows.length){await reply('Nothing found.');return{count:0};}
    await reply(rows.map(x=>`#${x.id} ${x.kind} — ${String(x.title||x.text||x.url||'').slice(0,160)}`).join('\n'));
    return{count:rows.length};
  }
};
