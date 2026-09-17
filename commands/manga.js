function format(rows){return rows.map((x,i)=>`${i+1}. ${x.title}${x.score?` — ${x.score}/10`:''}${x.status?` — ${x.status}`:''}${x.url?`\n${x.url}`:''}`).join('\n\n');}
export default {
  name:'manga',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'content',
  async execute({args,argsText,reply,features}){const mode=String(args?.[0]||'menu').toLowerCase();if(mode==='menu'){await reply('Manga\n\nUse .manga trending, .manga popular, .manga recent, or .manga search <title>.');return{menu:true};}const q=mode==='search'?argsText.slice(argsText.toLowerCase().indexOf('search')+6).trim():'';if(mode==='search'&&!q)throw new Error('Use .manga search <title>');const rows=await features.manga(mode,q);await reply(rows.length?format(rows):'No manga found.');return{mode,count:rows.length};}
};
