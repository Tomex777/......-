export default {
  name:'describe',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply,features}){const r=await features.vision(raw);await reply([r.caption,r.text,r.tags?.length?`Tags: ${r.tags.join(', ')}`:''].filter(Boolean).join('\n\n')||'No description available.');return{caption:r.caption,tags:r.tags};}
};
