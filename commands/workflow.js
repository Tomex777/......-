import { NightAgent } from '../src/ai/agent.js';
export default {
  name:'workflow',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:true,feature:'ai',
  async execute({argsText,message,senderJid,reply,ai,features,raw}){const request=String(argsText||'').trim();if(!request)throw new Error('Use .workflow <multi-step request>');const agent=new NightAgent({ai,features});const r=await agent.run({request,sessionId:message.sessionId,chatJid:message.chatJid,senderJid,raw});if(r.output?.kind==='image')await reply({image:r.output.buffer,caption:r.output.caption||''});else await reply(typeof r.output==='string'?r.output:JSON.stringify(r.output,null,2));return{trace:r.trace,provider:r.planProvider,model:r.planModel};}
};
