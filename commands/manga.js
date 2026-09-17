function format(rows){return rows.map((x,i)=>`${i+1}. ${x.title}${x.score?` — ${x.score}/10`:''}${x.status?` — ${x.status}`:''}${x.url?`\n${x.url}`:''}`).join('\n\n');}

function menuPayload(){
  return {
    text:'Manga\nChoose what you want below.\n\nTo search for a title, use .manga search <title>.',
    footer:'Night',
    buttons:[
      { text:'Trending', id:'.manga trending' },
      { text:'Popular', id:'.manga popular' },
      {
        text:'More',
        sections:[{
          title:'Manga',
          rows:[
            { header:'', title:'Recent', description:'Publishing and recently active manga', id:'.manga recent' }
          ]
        }]
      }
    ]
  };
}

export default {
  name:'manga',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'content',
  async execute({args,argsText,reply,features}){
    const mode=String(args?.[0]||'menu').toLowerCase();
    if(mode==='menu'){
      await reply(menuPayload());
      return{menu:true,interactive:true};
    }
    const q=mode==='search'?argsText.slice(argsText.toLowerCase().indexOf('search')+6).trim():'';
    if(mode==='search'&&!q)throw new Error('Use .manga search <title>');
    const allowed=new Set(['trending','popular','recent','search']);
    if(!allowed.has(mode))throw new Error('Use .manga, .manga trending, .manga popular, .manga recent, or .manga search <title>.');
    const rows=await features.manga(mode,q);
    await reply(rows.length?format(rows):'No manga found.');
    return{mode,count:rows.length};
  }
};
