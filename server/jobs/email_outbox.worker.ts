import { logger } from "../lib/logger";
import type { JobConfig } from "./index";

export const emailOutboxJob: JobConfig = {
  name: "email_outbox",
  intervalMs: 60_000,
  handler: async () => {
    logger.debug("[EMAIL_OUTBOX] Processing pending emails...");
  },
};
