export function parseWaVersion(raw) {
  if (!raw) return null;
  const parts = String(raw).split(/[.,\s]+/).filter(Boolean).map(Number);
  return parts.length === 3 && parts.every(Number.isInteger) ? parts : null;
}

export async function resolveWaVersion(lib, { env = process.env, logger = console } = {}) {
  const pinned = parseWaVersion(env.NIGHT_WA_VERSION);
  if (pinned) return { version: pinned, source: 'NIGHT_WA_VERSION' };

  if (typeof lib?.fetchLatestWaWebVersion === 'function') {
    try {
      const result = await lib.fetchLatestWaWebVersion({});
      if (Array.isArray(result?.version) && result.version.length === 3 && result.version.every(Number.isInteger)) {
        return { version: result.version, source: 'web.whatsapp.com' };
      }
    } catch (error) {
      logger.warn?.({ err: error?.message || String(error) }, 'Live WhatsApp Web version lookup failed; using Lia default');
    }
  }

  return { version: null, source: 'library-default' };
}
