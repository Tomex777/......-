import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../src/ai/intentEngine.js';

const message={sessionId:'assistant',chatJid:'2348000000000@s.whatsapp.net'};

test('natural note request is safely planned into the note capability',async()=>{
  const saved=[];
  const ai={
    ask:async()=>({text:JSON.stringify({actions:[{type:'note',text:'buy milk'}]}),provider:'groq',model:'test'})
  };
  const features={noteAdd:text=>{saved.push(text);return 7;}};
  const intents=new IntentEngine({ai,features,logger:{warn(){}}});
  const result=await intents.handle({text:'make a note to buy milk',message,raw:null,senderJid:'2348000000000@s.whatsapp.net'});
  assert.deepEqual(saved,['buy milk']);
  assert.equal(result.payload.text,'Note #7 saved.');
  assert.match(result.intent,/agent\.note/);
});

test('comparison renders an image by default',async()=>{
  const ai={ask:async()=>({text:JSON.stringify({title:'Phones',columns:['Item','RAM'],rows:[{Item:'A',RAM:'8 GB'},{Item:'B',RAM:'12 GB'}]})})};
  const features={
    table:async spec=>{assert.equal(spec.title,'Phones');return Buffer.from('image');},
    tablePdf:async()=>{throw new Error('PDF should not be used by default');}
  };
  const intents=new IntentEngine({ai,features,logger:{warn(){}}});
  const result=await intents.handle({text:'compare phone A and phone B',message,raw:null,senderJid:'owner'});
  assert.equal(result.intent,'table.image');
  assert.equal(Buffer.isBuffer(result.payload.image),true);
});

test('comparison renders PDF only when requested',async()=>{
  const ai={ask:async()=>({text:JSON.stringify({title:'Phones',columns:['Item','RAM'],rows:[{Item:'A',RAM:'8 GB'}]})})};
  const features={
    table:async()=>{throw new Error('image should not be used');},
    tablePdf:async()=>Buffer.from('pdf')
  };
  const intents=new IntentEngine({ai,features,logger:{warn(){}}});
  const result=await intents.handle({text:'compare phone A and phone B and make it a PDF',message,raw:null,senderJid:'owner'});
  assert.equal(result.intent,'table.pdf');
  assert.equal(result.payload.mimetype,'application/pdf');
  assert.equal(Buffer.isBuffer(result.payload.document),true);
});
