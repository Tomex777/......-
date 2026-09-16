import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/whatsapp/sessionManager.js', import.meta.url), 'utf8');

test('all Night sessions use the proven Main socket baseline', () => {
  assert.match(source, /browser:\s*Browsers\.macOS\('Chrome'\)/);
  assert.match(source, /markOnlineOnConnect:\s*false/);
  assert.match(source, /syncFullHistory:\s*false/);
  assert.match(source, /generateHighQualityLinkPreview:\s*false/);
  assert.match(source, /NIGHT_WA_VERSION/);

  assert.doesNotMatch(source, /Browsers\.windows/);
  assert.doesNotMatch(source, /shouldSyncHistoryMessage/);
  assert.doesNotMatch(source, /fetchLatestWaWebVersion/);
  assert.doesNotMatch(source, /createNightSocketOptions/);
  assert.doesNotMatch(source, /resolveWaVersion/);
});
