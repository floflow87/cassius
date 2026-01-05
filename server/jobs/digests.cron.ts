import { logger } from "../lib/logger";
import type { JobConfig } from "./index";

export const digestsCronJob: JobConfig = {
  name: "digests_cron",
  intervalMs: 60_000,
  handler: async () => {
    logger.debug("[DIGESTS] Running daily digest for users with digest preferences...");
  },
};
