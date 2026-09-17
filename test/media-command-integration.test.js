import test from 'node:test';
import assert from 'node:assert/strict';
import downloadCommand from '../commands/download.js';
import documentCommand from '../commands/document.js';
import scanQrCommand from '../commands/scanqr.js';
import summarizeCommand from '../commands/summarize.js';
import ttsCommand from '../commands/tts.js';
import viewOnceCommand from '../commands/viewonce.js';

const message={sessionId:'assistant',chatJid:'2348000000000@s.whatsapp.net'};
const quotedTextRaw=text=>({message:{extendedTextMessage:{contextInfo:{quotedMessage:{conversation:text}}}}});

test('.tts reads replied text when no explicit text is supplied',async()=>{
  let spoken='';let payload=null;
  const features={tts:async text=>{spoken=text;return Buffer.from('audio');}};
  await ttsCommand.execute({argsText:'',raw:quotedTextRaw('Read this aloud'),reply:async value=>{payload=value;},features});
  assert.equal(spoken,'Read this aloud');
  assert.equal(payload.mimetype,'audio/mpeg');
  assert.equal(Buffer.isBuffer(payload.audio),true);
});

test('.download accepts a URL from a replied text message',async()=>{
  let requested='';let payload=null;
  const features={download:async url=>{requested=url;return{buffer:Buffer.from('png'),mimetype:'image/png',fileName:'photo.png'};}};
  const result=await downloadCommand.execute({argsText:'',raw:quotedTextRaw('Here: https://example.com/photo.png'),reply:async value=>{payload=value;},features});
  assert.equal(requested,'https://example.com/photo.png');
  assert.equal(result.url,'https://example.com/photo.png');
  assert.equal(payload.caption,'photo.png');
  assert.equal(Buffer.isBuffer(payload.image),true);
});

test('.document uses the same document capability as natural AI',async()=>{
  let asked='';let reply='';
  const features={readDocument:async()=>({text:'Budget is 42.',kind:'pdf',fileName:'budget.pdf',pages:1})};
  const ai={ask:async({text})=>{asked=text;return{text:'The budget is 42.',provider:'test',model:'test-model'};}};
  const result=await documentCommand.execute({argsText:'What is the budget?',raw:{},message,senderJid:'owner',reply:async value=>{reply=value;},ai,features});
  assert.match(asked,/Budget is 42/);
  assert.equal(reply,'The budget is 42.');
  assert.equal(result.kind,'pdf');
});

test('.scanqr routes through the QR capability hub',async()=>{
  let reply='';
  const result=await scanQrCommand.execute({raw:{},reply:async value=>{reply=value;},features:{scanQr:async()=> 'night://hello'}});
  assert.equal(reply,'night://hello');
  assert.equal(result.text,'night://hello');
});

test('.viewonce routes through the shared view-once capability',async()=>{
  let payload=null;
  const features={openViewOnce:async()=>({kind:'video',buffer:Buffer.from('video'),mimetype:'video/mp4'})};
  const result=await viewOnceCommand.execute({raw:{},reply:async value=>{payload=value;},features});
  assert.equal(result.kind,'video');
  assert.equal(Buffer.isBuffer(payload.video),true);
  assert.equal(payload.caption,'View once opened');
});

test('.summarize still handles replied text directly',async()=>{
  let source='';let reply='';
  const ai={summarize:async({text})=>{source=text;return{text:'Short summary',provider:'test',model:'test-model'};}};
  const result=await summarizeCommand.execute({argsText:'',raw:quotedTextRaw('A long message'),message,senderJid:'owner',reply:async value=>{reply=value;},ai,features:{}});
  assert.equal(source,'A long message');
  assert.equal(reply,'Short summary');
  assert.equal(result.sourceKind,'text');
});
