export default {
  name:'catchup',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'groups',
  async execute({args,message,reply,features}){const target=String(args?.[0]||'').includes('@g.us')?String(args[0]):message.chatJid;const r=await features.catchup({sessionId:message.sessionId,chatJid:target});await reply(r.text);return{target,provider:r.provider,model:r.model};}
};
