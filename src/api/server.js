import http from 'node:http';
import { URL } from 'node:url';
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
const readJson=req=>new Promise((resolve,reject)=>{let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1000000)req.destroy();});req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch(e){reject(e);}});req.on('error',reject);});
export function createCortexServer({config,registry,roleManager,sessions,inbox,access}) {
  const token=String(config.get('CORTEX_API_TOKEN',''));
  return http.createServer(async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health')return json(res,200,{ok:true,service:'night-core'});
    if(!token||req.headers.authorization!==`Bearer ${token}`)return json(res,401,{error:'unauthorized'});
    if(req.method==='GET'&&url.pathname==='/api/cortex/config')return json(res,200,config.publicSnapshot());
    if(req.method==='GET'&&url.pathname==='/api/cortex/commands')return json(res,200,registry.snapshot());
    if(req.method==='GET'&&url.pathname==='/api/cortex/sessions')return json(res,200,{sessions:sessions.snapshot(),roles:roleManager.snapshot()});
    if(req.method==='GET'&&url.pathname==='/api/cortex/access')return json(res,200,{allowedChats:access.list()});
    if(req.method==='GET'&&url.pathname==='/api/cortex/inbox/chats'){const sessionId=url.searchParams.get('session')||roleManager.resolve('inbox')||config.get('WHATSAPP_INBOX_SESSION','main');return json(res,200,inbox.listChats(sessionId));}
    const msgMatch=url.pathname.match(/^\/api\/cortex\/inbox\/chats\/(.+)\/messages$/);
    if(msgMatch&&req.method==='GET'){const jid=decodeURIComponent(msgMatch[1]);const sessionId=url.searchParams.get('session')||roleManager.resolve('inbox')||config.get('WHATSAPP_INBOX_SESSION','main');return json(res,200,inbox.listMessages(sessionId,jid,Number(url.searchParams.get('limit')||100)));}
    if(msgMatch&&req.method==='POST'){const jid=decodeURIComponent(msgMatch[1]);if(!access.isAllowed(jid))return json(res,403,{error:'chat-disabled'});const body=await readJson(req);if(!body.text&&!body.content)return json(res,400,{error:'message-content-required'});const sent=await sessions.send('inbox',jid,body.content??{text:body.text});return json(res,202,{accepted:true,id:sent?.key?.id??null});}
    const reloadMatch=url.pathname.match(/^\/api\/cortex\/commands\/([^/]+)\/reload$/);
    if(reloadMatch&&req.method==='POST'){const cmd=registry.resolveCommand(decodeURIComponent(reloadMatch[1]));if(!cmd)return json(res,404,{error:'command-not-found'});const ok=await registry.reloadFile(cmd.__file,'command');return json(res,ok?200:500,{ok});}
    return json(res,404,{error:'not-found'});
  }catch(error){return json(res,500,{error:'internal-error',message:process.env.NODE_ENV==='development'?error.message:undefined});}});
}
