import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessage } from '../src/whatsapp/normalizeMessage.js';
import animeCommand from '../commands/anime.js';
import mangaCommand from '../commands/manga.js';

test('normalizes regular button replies into command text', () => {
  const message = normalizeMessage({
    key: { id:'1', remoteJid:'2348000000000@s.whatsapp.net', fromMe:false },
    message: { buttonsResponseMessage: { selectedButtonId:'.anime trending', selectedDisplayText:'Trending' } }
  }, { sessionId:'assistant' });
  assert.equal(message.text, '.anime trending');
});

test('normalizes list replies into command text', () => {
  const message = normalizeMessage({
    key: { id:'2', remoteJid:'2348000000000@s.whatsapp.net', fromMe:false },
    message: { listResponseMessage: { singleSelectReply: { selectedRowId:'.manga recent' }, title:'Recent' } }
  });
  assert.equal(message.text, '.manga recent');
});

test('normalizes native-flow replies into command text', () => {
  const message = normalizeMessage({
    key: { id:'3', remoteJid:'2348000000000@s.whatsapp.net', fromMe:false },
    message: { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson:JSON.stringify({ id:'.anime popular' }) } } }
  });
  assert.equal(message.text, '.anime popular');
});

test('.anime with no arguments sends an interactive menu', async () => {
  let payload;
  const result = await animeCommand.execute({ args:[], argsText:'', reply:async value => { payload=value; }, features:{} });
  assert.equal(result.interactive, true);
  assert.equal(Array.isArray(payload.buttons), true);
  assert.equal(payload.buttons[0].id, '.anime trending');
  assert.equal(payload.buttons[1].id, '.anime popular');
  assert.equal(payload.buttons[2].sections[0].rows[0].id, '.anime airing');
});

test('.manga with no arguments sends an interactive menu', async () => {
  let payload;
  const result = await mangaCommand.execute({ args:[], argsText:'', reply:async value => { payload=value; }, features:{} });
  assert.equal(result.interactive, true);
  assert.equal(Array.isArray(payload.buttons), true);
  assert.equal(payload.buttons[0].id, '.manga trending');
  assert.equal(payload.buttons[1].id, '.manga popular');
  assert.equal(payload.buttons[2].sections[0].rows[0].id, '.manga recent');
});
