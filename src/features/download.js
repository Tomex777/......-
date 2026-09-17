import dns from 'node:dns/promises';
import net from 'node:net';

function privateIp(ip){
  if(net.isIP(ip)===4){const p=ip.split('.').map(Number);return p[0]===10||p[0]===127||p[0]===0||(p[0]===169&&p[1]===254)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168);}
  if(net.isIP(ip)===6){const x=ip.toLowerCase();return x==='::1'||x.startsWith('fc')||x.startsWith('fd')||x.startsWith('fe80:');}
  return true;
}

export async function fetchPublicFile(url,{maxBytes=25*1024*1024}={}){
  const u=new URL(String(url));if(!['http:','https:'].includes(u.protocol))throw new Error('Only http/https URLs are supported.');
  if(u.username||u.password)throw new Error('URLs with embedded credentials are not allowed.');
  const addrs=await dns.lookup(u.hostname,{all:true});if(!addrs.length||addrs.some(x=>privateIp(x.address)))throw new Error('Private or local network URLs are not allowed.');
  const res=await fetch(u,{redirect:'follow',headers:{'user-agent':'Night/0.3'}});if(!res.ok)throw new Error(`Download failed with HTTP ${res.status}`);
  const len=Number(res.headers.get('content-length')||0);if(len>maxBytes)throw new Error(`File is larger than ${Math.round(maxBytes/1024/1024)} MB.`);
  const reader=res.body?.getReader?.();if(!reader)throw new Error('Download stream unavailable.');
  const chunks=[];let total=0;while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw new Error(`File is larger than ${Math.round(maxBytes/1024/1024)} MB.`);chunks.push(Buffer.from(value));}
  const type=res.headers.get('content-type')?.split(';')[0]||'application/octet-stream';const cd=res.headers.get('content-disposition')||'';const name=cd.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i)?.[1]||u.pathname.split('/').filter(Boolean).pop()||'download';
  return{buffer:Buffer.concat(chunks),mimetype:type,fileName:decodeURIComponent(name).replace(/[\\/:*?"<>|]/g,'_')};
}
