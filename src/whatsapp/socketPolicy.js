// Night must not import a user's full WhatsApp message archive, but Lia still
// needs the smaller bootstrap/history-sync classes used for LID mappings and
// linked-device/app-state initialization. Blocking every sync type causes Lia's
// explicit "DANGER" warning and can leave a newly linked device unusable.
//
// WhatsApp/Baileys HistorySyncType.FULL is enum value 2. Night accepts every
// other processable sync type and rejects FULL only. This matches Lia's safe
// default while keeping syncFullHistory disabled.
export const FULL_HISTORY_SYNC_TYPE = 2;

export function shouldSyncNightHistoryMessage({ syncType } = {}, fullHistorySyncType = FULL_HISTORY_SYNC_TYPE) {
  return syncType !== fullHistorySyncType;
}

export function createNightSocketOptions({ auth, logger, browser, fullHistorySyncType = FULL_HISTORY_SYNC_TYPE }) {
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
