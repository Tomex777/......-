export default {
  name:'schedules',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({args,reply,features}){const sub=String(args?.[0]||'').toLowerCase();if(sub==='cancel'){const id=Number(args?.[1]);if(!id)throw new Error('Use .schedules cancel <id>');const ok=features.store.cancelScheduledAction(id);await reply(ok?`Scheduled action #${id} cancelled.`:`Scheduled action #${id} not found.`);return{cancelled:ok,id};}const rows=features.store.listScheduledActions(100);if(!rows.length){await reply('No scheduled actions.');return{count:0};}await reply(rows.map(x=>`#${x.id} ${new Date(x.due_at).toLocaleString('en-NG')} — ${x.action}: ${x.payload?.text||''}`).join('\n'));return{count:rows.length};}
};
