export default {
  name:'meme',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'content',
  async execute({reply,features}){const rows=await features.memes(false);if(!rows.length){await reply('No meme found right now.');return{count:0};}const item=rows[Math.floor(Math.random()*rows.length)];await reply({image:{url:item.url},caption:item.title});return{title:item.title,url:item.url};}
};
