const units={
  mm:{kind:'length',toBase:v=>v/1000,fromBase:v=>v*1000},cm:{kind:'length',toBase:v=>v/100,fromBase:v=>v*100},m:{kind:'length',toBase:v=>v,fromBase:v=>v},km:{kind:'length',toBase:v=>v*1000,fromBase:v=>v/1000},in:{kind:'length',toBase:v=>v*0.0254,fromBase:v=>v/0.0254},ft:{kind:'length',toBase:v=>v*0.3048,fromBase:v=>v/0.3048},mi:{kind:'length',toBase:v=>v*1609.344,fromBase:v=>v/1609.344},
  g:{kind:'mass',toBase:v=>v,fromBase:v=>v},kg:{kind:'mass',toBase:v=>v*1000,fromBase:v=>v/1000},lb:{kind:'mass',toBase:v=>v*453.59237,fromBase:v=>v/453.59237},oz:{kind:'mass',toBase:v=>v*28.349523125,fromBase:v=>v/28.349523125},
  ml:{kind:'volume',toBase:v=>v,fromBase:v=>v},l:{kind:'volume',toBase:v=>v*1000,fromBase:v=>v/1000},cup:{kind:'volume',toBase:v=>v*236.5882365,fromBase:v=>v/236.5882365}
};
function temp(value,from,to){const c=from==='c'?value:from==='f'?(value-32)*5/9:value-273.15;return to==='c'?c:to==='f'?c*9/5+32:c+273.15;}
export default {
  name:'convertunit',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({args,reply}){if(args.length<3)throw new Error('Use .convertunit <value> <from> <to>');const value=Number(args[0]);const from=String(args[1]).toLowerCase(),to=String(args[2]).toLowerCase();if(!Number.isFinite(value))throw new Error('Invalid number.');let result;if(['c','f','k'].includes(from)&&['c','f','k'].includes(to))result=temp(value,from,to);else{const a=units[from],b=units[to];if(!a||!b||a.kind!==b.kind)throw new Error('Unsupported or incompatible units.');result=b.fromBase(a.toBase(value));}await reply(`${value} ${from} = ${Number(result.toFixed(6))} ${to}`);return{value,from,to,result};}
};
