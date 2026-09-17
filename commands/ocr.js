export default {
  name:'ocr',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'media',
  async execute({raw,reply,features}){const r=await features.vision(raw);const text=r.text||r.caption||'No text found.';await reply(text);return{caption:r.caption,tags:r.tags};}
};
