export default {
  name:'calc',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({argsText,reply}){const expr=String(argsText||'').trim();if(!expr)throw new Error('Use .calc <expression>');if(!/^[0-9+\-*/%().\s]+$/.test(expr))throw new Error('Only numeric arithmetic is allowed.');let result;try{result=Function(`"use strict"; return (${expr})`)();}catch{throw new Error('Invalid arithmetic expression.');}if(typeof result!=='number'||!Number.isFinite(result))throw new Error('Result is not a finite number.');await reply(String(result));return{expression:expr,result};}
};
