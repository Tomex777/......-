export default {
  name:'storage',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'library',
  async execute({reply,features}){const s=features.storageStats();await reply(['Night storage',`Saved items: ${s.items}`,`Notes: ${s.notes}`,`Todos: ${s.todos}`,`Reminders: ${s.reminders}`,`Observed chats: ${s.observed}`].join('\n'));return s;}
};
