export default {
  name:'transcribe',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply,features}){const r=await features.transcribe(raw);await reply(r.text);return{characters:r.text.length};}
};
