export default {
  name:'archive',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({args,reply,features}){const id=Number(args?.[0]);if(!id)throw new Error('Use .archive <saved item id>');const ok=features.libraryArchive(id);await reply(ok?`Archived #${id}.`:`Saved item #${id} was not found.`);return{archived:ok,id};}
};
