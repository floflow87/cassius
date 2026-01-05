import { logger } from "../lib/logger";
import type { JobConfig } from "./index";

export const googleSyncJob: JobConfig = {
  name: "google_sync",
  intervalMs: 5 * 60_000,
  handler: async () => {
    logger.debug("[GOOGLE_SYNC] Syncing calendar events...");
  },
};
