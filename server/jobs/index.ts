import { logger } from "../lib/logger";

export interface JobConfig {
  intervalMs: number;
  name: string;
  handler: () => Promise<void>;
}

const jobs: Map<string, NodeJS.Timeout> = new Map();

export function registerJob(config: JobConfig): void {
  if (jobs.has(config.name)) {
    logger.warn(`Job ${config.name} already registered, skipping`);
    return;
  }

  const interval = setInterval(async () => {
    try {
      await config.handler();
    } catch (error) {
      logger.error(`Job ${config.name} failed`, { error: (error as Error).message });
    }
  }, config.intervalMs);

  jobs.set(config.name, interval);
  logger.info(`Job ${config.name} registered`, { intervalMs: config.intervalMs });
}

export function stopJob(name: string): void {
  const interval = jobs.get(name);
  if (interval) {
    clearInterval(interval);
    jobs.delete(name);
    logger.info(`Job ${name} stopped`);
  }
}

export function stopAllJobs(): void {
  jobs.forEach((interval, name) => {
    clearInterval(interval);
    logger.info(`Job ${name} stopped`);
  });
  jobs.clear();
}

export async function runJobOnce(config: JobConfig): Promise<void> {
  logger.info(`Running job ${config.name} once`);
  try {
    await config.handler();
    logger.info(`Job ${config.name} completed`);
  } catch (error) {
    logger.error(`Job ${config.name} failed`, { error: (error as Error).message });
    throw error;
  }
}
