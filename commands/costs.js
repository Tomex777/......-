export default {
  name:'costs',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'history',
  async execute({reply,activity,config}){
    const month=new Date();month.setDate(1);month.setHours(0,0,0,0);
    const rows=activity.tokenUsage({since:month.getTime()});
    const cap=Number(config.get('DEEPSEEK_MONTHLY_CAP_USD',2))||2;
    const lines=['AI usage this month',`DeepSeek configured cap: $${cap.toFixed(2)}`,''];
    if(!rows.length)lines.push('No token usage recorded yet.');
    else for(const x of rows)lines.push(`${x.provider} / ${x.model}\nRequests: ${x.requests} · Tokens: ${x.totalTokens} (in ${x.promptTokens}, out ${x.completionTokens})`);
    lines.push('','Night records provider token usage exactly when the provider reports it. Dollar totals are not guessed without an explicit price table.');
    await reply(lines.join('\n'));return{rows,deepseekCapUsd:cap};
  }
};
