export async function runStartupPairing({ config, sessions, pairing, logger = console } = {}) {
  if (!config || !sessions || !pairing) throw new Error('startup pairing dependencies required');

  const sessionId = String(config.get('PAIRING_SESSION', 'main') || 'main').trim().toLowerCase();
  const digits = String(config.get('PAIRING_PHONE_NUMBER', '') || '').replace(/\D/g, '');

  if (!digits) return { status: 'disabled', sessionId };
  if (digits.length < 7 || digits.length > 16) throw new Error('PAIRING_PHONE_NUMBER must be a valid international number');

  if (sessions.hasStoredAuth(sessionId) || sessions.isRegistered(sessionId)) {
    logger.info?.({ sessionId }, 'Startup pairing skipped; session already has saved auth');
    return { status: 'already-paired', sessionId };
  }

  const result = await pairing.startCode(sessionId, digits);
  if (!result?.code) throw new Error(`Pairing code was not returned for ${sessionId}`);

  logger.info?.({ sessionId }, 'Startup pairing code ready');
  console.log(`\n=== NIGHT PAIRING CODE (${sessionId}) ===\n${result.code}\n==================================\n`);
  return { status: 'waiting', sessionId, code: result.code };
}
