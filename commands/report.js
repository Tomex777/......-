export default {
  name:'report',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'system',
  async execute({reply,activity,sessions,roleManager,registry,features}){
    const roles=roleManager.snapshot();const ids=roles?.config?.sessions||[];const states=ids.map(id=>sessions.sessionSnapshot(id));const usage=activity.usage();const storage=features.storageStats();const moduleErrors=registry.errors.size;
    const lines=['Night report','',...states.map(s=>`${s.id}: ${s.state}${s.registered?' / paired':''}`),`Activity: ${usage.total} (${usage.ai} AI, ${usage.commands} commands)`,`Failures: ${usage.failures}`,`Saved items: ${storage.items}`,`Reminders: ${storage.reminders}`,`Observed chats: ${storage.observed}`,`Module errors: ${moduleErrors}`];
    await reply(lines.join('\n'));return{states,usage,storage,moduleErrors};
  }
};
