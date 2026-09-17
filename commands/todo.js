export default {
  name:'todo',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'todo',
  async execute({args,argsText,reply,features}){
    const sub=String(args?.[0]||'').toLowerCase();
    if(sub==='done'){const id=Number(args?.[1]);if(!id)throw new Error('Use .todo done <id>');const ok=features.todoDone(id);await reply(ok?`Todo #${id} completed.`:`Todo #${id} not found.`);return{done:ok,id};}
    if(sub==='delete'){const id=Number(args?.[1]);if(!id)throw new Error('Use .todo delete <id>');const ok=features.todoDelete(id);await reply(ok?`Todo #${id} deleted.`:`Todo #${id} not found.`);return{deleted:ok,id};}
    const text=String(argsText||'').trim();if(!text)throw new Error('Use .todo <task>, .todo done <id>, or .todo delete <id>');const id=features.todoAdd(text);await reply(`Todo #${id} added.`);return{id};
  }
};
