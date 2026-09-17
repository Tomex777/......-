import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ActivityStore } from '../src/history/activityStore.js';
import { sendActivityReport } from '../src/reports/activityReport.js';
import usageCommand from '../commands/usage.js';

function makeStore(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'night-report-'));
  return {store:new ActivityStore(path.join(dir,'night.sqlite')),dir};
}

test('recent history is rendered as one image while all() remains complete',async()=>{
  const {store,dir}=makeStore();
  try{
    store.logCommand({at:1,name:'menu',input:'',success:true});
    store.logAI({at:2,name:'chat',input:'hello',output:'hi',success:true,provider:'groq'});
    store.logCommand({at:3,name:'search',input:'news',success:true});
    assert.equal(store.recent({limit:2}).length,2);
    assert.equal(store.all().length,3);

    let payload;
    const result=await sendActivityReport({activity:store,reply:async value=>{payload=value;},recentLimit:2});
    assert.equal(result.image,true);
    assert.equal(result.count,2);
    assert.equal(Buffer.isBuffer(payload.image),true);
    assert.match(payload.caption,/\.history pdf/);
  }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('history PDF asks ActivityStore for the complete log',async()=>{
  const {store,dir}=makeStore();
  try{
    for(let i=0;i<4;i++)store.logCommand({at:i+1,name:`cmd${i}`,input:String(i),success:true});
    let payload;
    const result=await sendActivityReport({activity:store,reply:async value=>{payload=value;},pdf:true});
    assert.equal(result.pdf,true);
    assert.equal(result.complete,true);
    assert.equal(result.count,4);
    assert.equal(Buffer.isBuffer(payload.document),true);
    assert.equal(payload.mimetype,'application/pdf');
  }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('.usage renders the compact dashboard as one image',async()=>{
  const fake={usage:()=>({total:12,commands:8,ai:4,failures:1,today:5,topCommands:[{name:'search',count:3}],providers:[{provider:'groq',count:4}]})};
  let payload;
  const result=await usageCommand.execute({args:[],activity:fake,reply:async value=>{payload=value;}});
  assert.equal(result.image,true);
  assert.equal(Buffer.isBuffer(payload.image),true);
  assert.match(payload.caption,/\.usage pdf/);
});
