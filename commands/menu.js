const LABELS = {
  access:'Access', system:'System', ai:'AI', history:'History', media:'Media', storage:'Storage', library:'Library',
  notes:'Notes', todo:'Tasks', reminders:'Reminders', whatsapp:'WhatsApp', privacy:'Privacy', utility:'Utilities', games:'Games', content:'Content'
};

export default {
  name:'menu',aliases:[],ownerOnly:false,requiresAllowedChat:true,requiresAI:false,feature:'system',
  async execute({registry,reply}){
    const commands=registry.snapshot().filter(item=>item.name!=='menu');const groups=new Map();
    for(const item of commands){const key=item.feature||'other';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(`.${item.name}`);}
    const preferred=['system','access','ai','whatsapp','media','library','storage','notes','todo','reminders','privacy','content','games','utility','history','other'];
    const lines=['Night menu'];for(const key of preferred){const items=groups.get(key);if(!items?.length)continue;lines.push('',LABELS[key]||'Other',items.sort().join('  '));}
    lines.push('','You can also talk to Night normally; commands are shortcuts. Use .guide <what you want to do> when you are unsure.');
    await reply(lines.join('\n'));return{count:commands.length};
  }
};
