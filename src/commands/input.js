function unwrap(message = {}) {
  let node = message;
  let guard = 0;
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage'];
  while (node && guard++ < 8) {
    const key = wrappers.find(name => node?.[name]?.message);
    if (!key) break;
    node = node[key].message;
  }
  return node || {};
}

export function textFromMessageNode(message = {}) {
  const content = unwrap(message);
  if (typeof content.conversation === 'string') return content.conversation;
  for (const key of Object.keys(content)) {
    const value = content[key];
    if (!value || typeof value !== 'object') continue;
    const text = value.text ?? value.caption ?? value.name ?? null;
    if (typeof text === 'string' && text.trim()) return text;
  }
  return '';
}

export function quotedText(raw = null) {
  const content = unwrap(raw?.message ?? {});
  for (const key of Object.keys(content)) {
    const payload = content[key];
    const quoted = payload?.contextInfo?.quotedMessage;
    if (quoted) return textFromMessageNode(quoted);
  }
  return '';
}

export function commandInput({ argsText = '', raw = null } = {}) {
  return String(argsText || '').trim() || String(quotedText(raw) || '').trim();
}
