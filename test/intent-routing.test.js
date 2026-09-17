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

test('natural poll request is planned into a real WhatsApp poll',async()=>{
  let pollArgs=null;
  const ai={ask:async()=>({text:JSON.stringify({actions:[{type:'poll',question:'Lunch?',options:['Rice','Pasta']}]}),provider:'groq',model:'test'})};
  const features={poll:async args=>{pollArgs=args;}};
  const intents=new IntentEngine({ai,features,logger:{warn(){}}});
  const result=await intents.handle({text:'create a poll asking whether we should eat rice or pasta for lunch',message,raw:null,senderJid:'owner'});
  assert.equal(pollArgs.question,'Lunch?');
  assert.deepEqual(pollArgs.options,['Rice','Pasta']);
  assert.equal(result.payload.text,'Poll created.');
  assert.match(result.intent,/agent\.poll/);
});

test('natural image compression request returns the edited image',async()=>{
  const ai={ask:async()=>({text:JSON.stringify({actions:[{type:'compress_image'}]}),provider:'groq',model:'test'})};
  const features={compress:async()=>Buffer.from('compressed')};
  const intents=new IntentEngine({ai,features,logger:{warn(){}}});
  const result=await intents.handle({text:'compress this image for me',message,raw:{},senderJid:'owner'});
  assert.equal(Buffer.isBuffer(result.payload.image),true);
  assert.equal(result.payload.caption,'Compressed');
  assert.match(result.intent,/agent\.compress_image/);
});

test('natural document request reads the replied document before asking AI',async()=>{
  let prompt='';
  const ai={ask:async({text})=>{prompt=text;return{text:'It is a short report.'};}};
  const features={readDocument:async()=>({text:'Revenue rose by 20%.',kind:'pdf',fileName:'report.pdf'})};
  const intents=new IntentEngine({ai,features,logger:{warn(){}}});
  const result=await intents.handle({text:'summarize this PDF for me',message,raw:{},senderJid:'owner'});
  assert.equal(result.intent,'document.read');
  assert.equal(result.payload.text,'It is a short report.');
  assert.match(prompt,/Revenue rose by 20%/);
  assert.match(prompt,/report\.pdf/);
});

test('natural QR scan request returns decoded text',async()=>{
  const features={scanQr:async()=> 'https://example.com/night'};
  const intents=new IntentEngine({ai:{},features,logger:{warn(){}}});
  const result=await intents.handle({text:'scan this QR code',message,raw:{},senderJid:'owner'});
  assert.equal(result.intent,'qr.scan');
  assert.equal(result.payload.text,'https://example.com/night');
});

test('natural view-once request returns the recovered media payload',async()=>{
  const features={openViewOnce:async()=>({kind:'video',buffer:Buffer.from('video'),mimetype:'video/mp4'})};
  const intents=new IntentEngine({ai:{},features,logger:{warn(){}}});
  const result=await intents.handle({text:'open this view once for me',message,raw:{},senderJid:'owner'});
  assert.equal(result.intent,'viewonce.open');
  assert.equal(Buffer.isBuffer(result.payload.video),true);
  assert.equal(result.payload.mimetype,'video/mp4');
});

test('natural download request fetches a public URL and returns the right WhatsApp payload',async()=>{
  let url='';
  const features={download:async value=>{url=value;return{buffer:Buffer.from('image'),mimetype:'image/png',fileName:'night.png'};}};
  const intents=new IntentEngine({ai:{},features,logger:{warn(){}}});
  const result=await intents.handle({text:'download https://example.com/night.png',message,raw:null,senderJid:'owner'});
  assert.equal(url,'https://example.com/night.png');
  assert.equal(result.intent,'download');
  assert.equal(Buffer.isBuffer(result.payload.image),true);
  assert.equal(result.payload.caption,'night.png');
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

test('comparison uses web research as grounding when search is available',async()=>{
  let searched=false;
  let askPrompt='';
  const ai={
    search:async({text})=>{searched=true;assert.match(text,/Research the facts needed/);return{text:'Phone A has 8 GB RAM. Phone B has 12 GB RAM.'};},
    ask:async({text})=>{askPrompt=text;return{text:JSON.stringify({title:'Phones',columns:['Item','RAM'],rows:[{Item:'A',RAM:'8 GB'},{Item:'B',RAM:'12 GB'}]})};}
  };
  const features={table:async()=>Buffer.from('image')};
  const intents=new IntentEngine({ai,features,logger:{warn(){}}});
  const result=await intents.handle({text:'compare phone A and phone B',message,raw:null,senderJid:'owner'});
  assert.equal(searched,true);
  assert.match(askPrompt,/Web research to ground the comparison/);
  assert.match(askPrompt,/Phone A has 8 GB RAM/);
  assert.equal(result.intent,'table.image');
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
