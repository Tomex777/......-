export default {
  name:'gif',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'content',
  async execute({argsText,reply,features}){const q=String(argsText||'').trim();if(!q)throw new Error('Use .gif <query>');const rows=await features.gifs(q);if(!rows.length)throw new Error('No GIF found.');const item=rows[0];await reply({video:{url:item.url},gifPlayback:true,caption:item.title||q});return{query:q,url:item.url};}
};
