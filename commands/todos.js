export default {
  name:'todos',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'todo',
  async execute({args,reply,features}){const includeDone=String(args?.[0]||'').toLowerCase()==='all';const rows=features.todos(includeDone);if(!rows.length){await reply('No todos.');return{count:0};}await reply(rows.slice(0,50).map(x=>`${x.done?'✓':'•'} #${x.id} ${x.text}${x.due_at?` — due ${new Date(x.due_at).toLocaleString('en-NG')}`:''}`).join('\n'));return{count:rows.length};}
};
