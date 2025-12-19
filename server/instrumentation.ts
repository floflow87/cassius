import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  requestId: string;
  startTime: number;
  dbQueries: QueryTiming[];
  storageOperations: StorageTiming[];
}

interface QueryTiming {
  operation: string;
  table: string;
  durationMs: number;
  timestamp: number;
}

interface StorageTiming {
  operation: string;
  durationMs: number;
  timestamp: number;
}

interface EndpointStats {
  endpoint: string;
  method: string;
  avgDurationMs: number;
  maxDurationMs: number;
  minDurationMs: number;
  avgDbQueries: number;
  avgStorageOps: number;
  requestCount: number;
  lastRequest: number;
  samples: {
    durationMs: number;
    dbQueries: number;
    storageOps: number;
    timestamp: number;
  }[];
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();
const endpointStats = new Map<string, EndpointStats>();

const MAX_SAMPLES = 100;

export function createRequestContext(): RequestContext {
  return {
    requestId: crypto.randomUUID().slice(0, 8),
    startTime: Date.now(),
    dbQueries: [],
    storageOperations: [],
  };
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function trackDbQuery(operation: string, table: string, durationMs: number): void {
  const context = getContext();
  if (context) {
    context.dbQueries.push({
      operation,
      table,
      durationMs,
      timestamp: Date.now(),
    });
  }
}

export function trackStorageOperation(operation: string, durationMs: number): void {
  const context = getContext();
  if (context) {
    context.storageOperations.push({
      operation,
      durationMs,
      timestamp: Date.now(),
    });
  }
}

export function recordEndpointStats(method: string, path: string, context: RequestContext): void {
  const key = `${method} ${normalizeEndpoint(path)}`;
  const totalDuration = Date.now() - context.startTime;
  const dbQueryCount = context.dbQueries.length;
  const storageOpCount = context.storageOperations.length;
  
  const existing = endpointStats.get(key);
  
  if (existing) {
    existing.samples.push({
      durationMs: totalDuration,
      dbQueries: dbQueryCount,
      storageOps: storageOpCount,
      timestamp: Date.now(),
    });
    
    if (existing.samples.length > MAX_SAMPLES) {
      existing.samples.shift();
    }
    
    const durations = existing.samples.map(s => s.durationMs);
    const dbCounts = existing.samples.map(s => s.dbQueries);
    const storageCounts = existing.samples.map(s => s.storageOps);
    
    existing.avgDurationMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    existing.maxDurationMs = Math.max(...durations);
    existing.minDurationMs = Math.min(...durations);
    existing.avgDbQueries = Math.round((dbCounts.reduce((a, b) => a + b, 0) / dbCounts.length) * 10) / 10;
    existing.avgStorageOps = Math.round((storageCounts.reduce((a, b) => a + b, 0) / storageCounts.length) * 10) / 10;
    existing.requestCount++;
    existing.lastRequest = Date.now();
  } else {
    endpointStats.set(key, {
      endpoint: normalizeEndpoint(path),
      method,
      avgDurationMs: totalDuration,
      maxDurationMs: totalDuration,
      minDurationMs: totalDuration,
      avgDbQueries: dbQueryCount,
      avgStorageOps: storageOpCount,
      requestCount: 1,
      lastRequest: Date.now(),
      samples: [{
        durationMs: totalDuration,
        dbQueries: dbQueryCount,
        storageOps: storageOpCount,
        timestamp: Date.now(),
      }],
    });
  }
}

function normalizeEndpoint(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

export function getTopSlowestEndpoints(limit = 10): EndpointStats[] {
  return Array.from(endpointStats.values())
    .filter(s => s.requestCount >= 1)
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, limit)
    .map(s => ({
      ...s,
      samples: [],
    }));
}

export function getTopDbHeavyEndpoints(limit = 10): EndpointStats[] {
  return Array.from(endpointStats.values())
    .filter(s => s.requestCount >= 1)
    .sort((a, b) => b.avgDbQueries - a.avgDbQueries)
    .slice(0, limit)
    .map(s => ({
      ...s,
      samples: [],
    }));
}

export function getAllStats(): Record<string, EndpointStats> {
  const result: Record<string, EndpointStats> = {};
  const entries = Array.from(endpointStats.entries());
  for (const [key, value] of entries) {
    result[key] = { ...value, samples: [] };
  }
  return result;
}

export function clearStats(): void {
  endpointStats.clear();
}

export function formatContextSummary(context: RequestContext): string {
  const totalDuration = Date.now() - context.startTime;
  const dbTime = context.dbQueries.reduce((sum, q) => sum + q.durationMs, 0);
  const storageTime = context.storageOperations.reduce((sum, q) => sum + q.durationMs, 0);
  
  return `[${context.requestId}] total=${totalDuration}ms db=${dbTime}ms(${context.dbQueries.length}q) storage=${storageTime}ms(${context.storageOperations.length}ops)`;
}
