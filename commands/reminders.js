export default {
  name:'reminders',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'reminders',
  async execute({args,reply,features}){const sub=String(args?.[0]||'').toLowerCase();if(sub==='cancel'){const id=Number(args?.[1]);if(!id)throw new Error('Use .reminders cancel <id>');const ok=features.cancelReminder(id);await reply(ok?`Reminder #${id} cancelled.`:`Reminder #${id} not found.`);return{cancelled:ok,id};}const rows=features.reminders();if(!rows.length){await reply('No active reminders.');return{count:0};}await reply(rows.slice(0,50).map(x=>`#${x.id} ${new Date(x.due_at).toLocaleString('en-NG')} — ${x.text}`).join('\n'));return{count:rows.length};}
};
