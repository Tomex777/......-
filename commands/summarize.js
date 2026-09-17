import { downloadQuotedMedia, quotedText } from '../src/features/media.js';

export default {
  name: 'summarize',
  aliases: [],
  ownerOnly: true,
  requiresAllowedChat: true,
  requiresAI: true,
  feature: 'ai',
  async execute({ argsText, raw, message, senderJid, reply, ai, features }) {
    let text = String(argsText || '').trim() || quotedText(raw);
    let sourceKind = 'text';

    if (!text) {
      const media = await downloadQuotedMedia(raw);
      sourceKind = media.kind;
      if (media.kind === 'document') {
        const doc = await features.readDocument(raw);
        if (!doc.text) throw new Error('No readable text was found in that document.');
        text = `Document (${doc.fileName || doc.kind || 'file'}):\n${doc.text.slice(0, 45000)}`;
      } else if (media.kind === 'audio' || media.kind === 'video') {
        const transcript = await features.transcribe(raw);
        text = `Transcript:\n${transcript.text}`;
      } else if (media.kind === 'image') {
        const vision = await features.vision(raw);
        text = [vision.caption, vision.text, vision.tags?.length ? `Tags: ${vision.tags.join(', ')}` : ''].filter(Boolean).join('\n');
        if (!text) throw new Error('No readable or describable content was found in that image.');
      } else {
        throw new Error('Reply to text, an image, a voice note, video, PDF, DOCX, or text document with .summarize');
      }
    }

    const result = await ai.summarize({
      text: sourceKind === 'text' ? text : `Summarize this ${sourceKind} faithfully.\n\n${text}`,
      sessionId: message.sessionId,
      chatJid: message.chatJid,
      senderJid
    });
    await reply(result.text);
    return { provider: result.provider, model: result.model, sourceKind };
  }
};
