export default {
  name:'delete',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({args,reply,features}){const id=Number(args?.[0]);if(!id)throw new Error('Use .delete <saved item id>');const ok=features.libraryDelete(id);await reply(ok?`Deleted #${id}.`:`Saved item #${id} was not found.`);return{deleted:ok,id};}
};
