const WRAPPERS = new Map([['ephemeralMessage','ephemeral'],['viewOnceMessage','viewOnce'],['viewOnceMessageV2','viewOnceV2'],['viewOnceMessageV2Extension','viewOnceV2Extension'],['documentWithCaptionMessage','documentWithCaption']]);
export function unwrapMessage(message = {}) {
  const wrappers = []; let node = message; let guard = 0;
  while (node && guard++ < 8) { const key = Object.keys(node).find(k => WRAPPERS.has(k)); if (!key) break; wrappers.push(WRAPPERS.get(key)); node = node[key]?.message ?? {}; }
  return { wrappers, content: node ?? {} };
}
export function normalizeMessage(raw, { sessionId = 'main' } = {}) {
  const { wrappers, content } = unwrapMessage(raw?.message ?? {}); const type = Object.keys(content)[0] ?? 'unknown'; const payload = content[type] ?? {};
  const key = raw?.key ?? {};
  const text = type === 'conversation' ? content.conversation : payload.text ?? payload.caption ?? payload.name ?? null;
  const senderJid = key.participantAlt ?? key.participantPn ?? key.senderPn ?? key.remoteJidAlt ?? key.participant ?? key.remoteJid ?? null;
  return { id: key.id ?? null, sessionId, chatJid: key.remoteJid ?? null, participantJid: key.participant ?? null, senderJid,
    fromMe: Boolean(key.fromMe), timestamp: Number(raw?.messageTimestamp ?? Date.now()), type, wrappers,
    viewOnce: wrappers.some(x => x.startsWith('viewOnce')) || Boolean(payload.viewOnce), text, mimeType: payload.mimetype ?? null,
    fileName: payload.fileName ?? null, seconds: payload.seconds ?? null,
    contextInfo: payload.contextInfo ? { stanzaId: payload.contextInfo.stanzaId ?? null, participant: payload.contextInfo.participant ?? null, mentionedJid: payload.contextInfo.mentionedJid ?? [] } : null,
    raw: content };
}
