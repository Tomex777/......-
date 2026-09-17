function format(rows){return rows.map((x,i)=>`${i+1}. ${x.title}${x.score?` — ${x.score}/10`:''}${x.status?` — ${x.status}`:''}${x.url?`\n${x.url}`:''}`).join('\n\n');}

function menuPayload(){
  return {
    text:'Anime\nChoose what you want below.\n\nTo search for a title, use .anime search <title>.',
    footer:'Night',
    buttons:[
      { text:'Trending', id:'.anime trending' },
      { text:'Popular', id:'.anime popular' },
      {
        text:'More',
        sections:[{
          title:'Anime',
          rows:[
            { header:'', title:'Airing', description:'Anime currently airing', id:'.anime airing' },
            { header:'', title:'Recent', description:'Current-season and recent anime', id:'.anime recent' }
          ]
        }]
      }
    ]
  };
}

export default {
  name:'anime',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'content',
  async execute({args,argsText,reply,features}){
    const mode=String(args?.[0]||'menu').toLowerCase();
    if(mode==='menu'){
      await reply(menuPayload());
      return{menu:true,interactive:true};
    }
    const q=mode==='search'?argsText.slice(argsText.toLowerCase().indexOf('search')+6).trim():'';
    if(mode==='search'&&!q)throw new Error('Use .anime search <title>');
    const allowed=new Set(['trending','popular','airing','recent','search']);
    if(!allowed.has(mode))throw new Error('Use .anime, .anime trending, .anime popular, .anime airing, .anime recent, or .anime search <title>.');
    const rows=await features.anime(mode,q);
    await reply(rows.length?format(rows):'No anime found.');
    return{mode,count:rows.length};
  }
};
