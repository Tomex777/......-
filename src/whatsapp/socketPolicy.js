// Night must not import a user's full WhatsApp message archive, but Lia still
// needs the smaller bootstrap/history-sync classes used for LID mappings and
// linked-device/app-state initialization. Blocking every sync type causes Lia's
// explicit "DANGER" warning and can leave a newly linked device unusable.
//
// Therefore Night accepts all normal bootstrap sync classes and rejects only
// HistorySyncType.FULL. The enum value is supplied by the installed Lia build
// so this policy does not hard-code a protocol number.
export function shouldSyncNightHistoryMessage({ syncType } = {}, fullHistorySyncType) {
  if (fullHistorySyncType === undefined || fullHistorySyncType === null) return true;
  return syncType !== fullHistorySyncType;
}

export function createNightSocketOptions({ auth, logger, browser, fullHistorySyncType }) {
  return {
    auth,
    logger,
    browser,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: message => shouldSyncNightHistoryMessage(message, fullHistorySyncType),
    fireInitQueries: true,
    // Kept for parity with Night's known-working Nexia reference. Older Lia
    // builds may ignore this field; shouldSyncHistoryMessage above is the
    // authoritative guard that prevents FULL history import.
    downloadHistory: false,
    getMessage: async () => undefined,
    keepAliveIntervalMs: 30_000,
    retryRequestDelayMs: 250,
    generateHighQualityLinkPreview: false
  };
}
