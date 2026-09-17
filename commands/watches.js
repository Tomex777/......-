export default {
  name:'watches',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({args,reply,features}){const sub=String(args?.[0]||'').toLowerCase();if(sub==='cancel'){const id=Number(args?.[1]);if(!id)throw new Error('Use .watches cancel <id>');const ok=features.store.cancelWatch(id);await reply(ok?`Watch #${id} cancelled.`:`Watch #${id} not found.`);return{cancelled:ok,id};}const rows=features.store.listWatches(100);if(!rows.length){await reply('No active watches.');return{count:0};}await reply(rows.map(x=>`#${x.id} ${x.kind} — ${x.query}`).join('\n'));return{count:rows.length};}
};
