import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IntentEngine } from '../src/ai/intentEngine.js';
import menuCommand from '../commands/menu.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function buildIntentEngine() {
  const calls = { image: 0, pdf: 0 };
  const ai = {
    async search() { return { text: 'Grounded current specifications.' }; },
    async ask() {
      return {
        text: JSON.stringify({
          title: 'Galaxy Ultra comparison',
          columns: ['Item', 'Display'],
          rows: [
            { Item: 'S24 Ultra', Display: '6.8-inch' },
            { Item: 'S25 Ultra', Display: '6.9-inch' }
          ]
        })
      };
    }
  };
  const features = {
    async table(spec) { calls.image += 1; return Buffer.from(`image:${spec.title}`); },
    async tablePdf(spec) { calls.pdf += 1; return Buffer.from(`pdf:${spec.title}`); }
  };
  return { engine: new IntentEngine({ ai, features, sessions: {}, logger: { warn() {} } }), calls };
}

const context = {
  message: { sessionId: 'assistant', chatJid: 'owner@s.whatsapp.net' },
  raw: null,
  senderJid: 'owner@s.whatsapp.net'
};

test('comparisons render as an image by default', async () => {
  const { engine, calls } = buildIntentEngine();
  const result = await engine.handle({ ...context, text: 'Compare the S24 Ultra and S25 Ultra' });
  assert.equal(result.intent, 'table.image');
  assert.ok(Buffer.isBuffer(result.payload.image));
  assert.equal(calls.image, 1);
  assert.equal(calls.pdf, 0);
});

test('comparisons render as PDF only when the request asks for PDF/document output', async () => {
  const { engine, calls } = buildIntentEngine();
  const result = await engine.handle({ ...context, text: 'Compare the S24 Ultra and S25 Ultra as a PDF' });
  assert.equal(result.intent, 'table.pdf');
  assert.ok(Buffer.isBuffer(result.payload.document));
  assert.equal(result.payload.mimetype, 'application/pdf');
  assert.equal(calls.image, 0);
  assert.equal(calls.pdf, 1);
});

test('table rendering remains an AI capability, not a dot command', () => {
  assert.equal(fs.existsSync(path.join(root, 'commands', 'table.js')), false);
});

test('.menu shows canonical command names and never aliases', async () => {
  let output = '';
  await menuCommand.execute({
    registry: {
      snapshot: () => [
        { name: 'menu', aliases: [], feature: 'system' },
        { name: 'pinterest', aliases: ['pin'], feature: 'content' },
        { name: 'darkmeme', aliases: ['dark-meme'], feature: 'content' }
      ]
    },
    reply: async value => { output = value; }
  });
  assert.match(output, /\.pinterest/);
  assert.match(output, /\.darkmeme/);
  assert.doesNotMatch(output, /\.pin(?:\s|$)/m);
  assert.doesNotMatch(output, /\.dark-meme/);
});
