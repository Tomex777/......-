export default {
  name:'note',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'notes',
  async execute({argsText,reply,features}){const text=String(argsText||'').trim();if(!text)throw new Error('Use .note <text>');const id=features.noteAdd(text);await reply(`Note #${id} saved.`);return{id};}
};
