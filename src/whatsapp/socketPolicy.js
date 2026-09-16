// Night does not import WhatsApp message history. Lia's current default
// shouldSyncHistoryMessage accepts RECENT even when syncFullHistory is false,
// which makes a freshly linked device wait in AwaitingInitialSync for a
// history notification Night does not need. Reject history notifications
// explicitly so Lia transitions straight to Online and flushes live events.
export const shouldSyncNightHistoryMessage = () => false;

export function createNightSocketOptions({ auth, logger, browser }) {
  return {
    auth,
    logger,
    browser,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: shouldSyncNightHistoryMessage,
    fireInitQueries: true,
    generateHighQualityLinkPreview: false
  };
}
