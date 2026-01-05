/**
 * Performance Testing Utilities
 * 
 * Helper functions for performance testing, benchmarking,
 * and performance assertions in tests.
 */

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  iterations?: number;
  warmupIterations?: number;
  maxDuration?: number; // milliseconds
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  operationsPerSecond: number;
}

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  concurrency: number;
  duration?: number; // milliseconds
  iterations?: number;
  rampUpTime?: number; // milliseconds
}

/**
 * Load test result
 */
export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  duration: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errors: Array<{ message: string; count: number }>;
}

/**
 * Benchmark a function
 */
export async function benchmark(
  fn: () => Promise<any> | any,
  config: BenchmarkConfig = {}
): Promise<BenchmarkResult> {
  const {
    iterations = 100,
    warmupIterations = 10,
    maxDuration = 30000,
  } = config;

  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Benchmark phase
  const times: number[] = [];
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    // Check if we've exceeded max duration
    if (Date.now() - startTime > maxDuration) {
      break;
    }

    const iterationStart = performance.now();
    await fn();
    const iterationTime = performance.now() - iterationStart;
    times.push(iterationTime);
  }

  const totalTime = Date.now() - startTime;
  const sortedTimes = times.slice().sort((a, b) => a - b);
  const sum = times.reduce((acc, time) => acc + time, 0);

  return {
    iterations: times.length,
    totalTime,
    averageTime: sum / times.length,
    minTime: sortedTimes[0],
    maxTime: sortedTimes[sortedTimes.length - 1],
    medianTime: sortedTimes[Math.floor(sortedTimes.length / 2)],
    p95Time: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
    p99Time: sortedTimes[Math.floor(sortedTimes.length * 0.99)],
    operationsPerSecond: (times.length / totalTime) * 1000,
  };
}

/**
 * Compare two benchmark results
 */
export function compareBenchmarks(
  baseline: BenchmarkResult,
  current: BenchmarkResult
): {
  percentDifference: number;
  faster: boolean;
  significant: boolean;
} {
  const percentDifference =
    ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100;
  const faster = percentDifference < 0;
  // Consider significant if difference is > 10%
  const significant = Math.abs(percentDifference) > 10;

  return {
    percentDifference,
    faster,
    significant,
  };
}

/**
 * Run a load test
 */
export async function loadTest(
  fn: () => Promise<any>,
  config: LoadTestConfig
): Promise<LoadTestResult> {
  const {
    concurrency,
    duration,
    iterations,
    rampUpTime = 0,
  } = config;

  const results: Array<{ time: number; success: boolean; error?: Error }> = [];
  const errors: Map<string, number> = new Map();
  const startTime = Date.now();
  let requestCount = 0;

  // Calculate how many requests each worker should make
  const requestsPerWorker = iterations
    ? Math.ceil(iterations / concurrency)
    : Infinity;

  // Create worker functions
  const workers = Array.from({ length: concurrency }, async (_, workerIndex) => {
    // Implement ramp-up delay
    if (rampUpTime > 0) {
      const delay = (rampUpTime / concurrency) * workerIndex;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    let workerRequests = 0;

    while (true) {
      // Check termination conditions
      if (iterations && workerRequests >= requestsPerWorker) {
        break;
      }
      if (duration && Date.now() - startTime >= duration) {
        break;
      }

      requestCount++;
      workerRequests++;

      const requestStart = performance.now();
      try {
        await fn();
        const requestTime = performance.now() - requestStart;
        results.push({ time: requestTime, success: true });
      } catch (error) {
        const requestTime = performance.now() - requestStart;
        results.push({ time: requestTime, success: false, error: error as Error });

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1);
      }
    }
  });

  // Wait for all workers to complete
  await Promise.all(workers);

  const totalDuration = Date.now() - startTime;
  const successfulResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);
  const responseTimes = successfulResults.map((r) => r.time).sort((a, b) => a - b);

  return {
    totalRequests: results.length,
    successfulRequests: successfulResults.length,
    failedRequests: failedResults.length,
    duration: totalDuration,
    requestsPerSecond: (results.length / totalDuration) * 1000,
    averageResponseTime: responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length || 0,
    minResponseTime: responseTimes[0] || 0,
    maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
    p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
    p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)] || 0,
    errors: Array.from(errors.entries()).map(([message, count]) => ({ message, count })),
  };
}

/**
 * Assert performance is within threshold
 */
export function assertPerformance(
  actualTime: number,
  maxTime: number,
  message?: string
): void {
  if (actualTime > maxTime) {
    throw new Error(
      message ||
        `Performance assertion failed: ${actualTime}ms > ${maxTime}ms (${
          actualTime - maxTime
        }ms over threshold)`
    );
  }
}

/**
 * Assert average performance across multiple runs
 */
export async function assertAveragePerformance(
  fn: () => Promise<any> | any,
  maxAverageTime: number,
  iterations = 10,
  message?: string
): Promise<void> {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const time = performance.now() - start;
    times.push(time);
  }

  const average = times.reduce((sum, t) => sum + t, 0) / times.length;

  if (average > maxAverageTime) {
    throw new Error(
      message ||
        `Average performance assertion failed: ${average.toFixed(2)}ms > ${maxAverageTime}ms`
    );
  }
}

/**
 * Measure memory usage before and after an operation
 */
export async function measureMemory(
  fn: () => Promise<any> | any
): Promise<{
  before: number;
  after: number;
  delta: number;
}> {
  // Force garbage collection if available (Node.js with --expose-gc flag)
  if (global.gc) {
    global.gc();
  }

  const before = process.memoryUsage().heapUsed;
  await fn();

  if (global.gc) {
    global.gc();
  }

  const after = process.memoryUsage().heapUsed;

  return {
    before,
    after,
    delta: after - before,
  };
}

/**
 * Profile an async function and return detailed timing
 */
export async function profile<T>(
  fn: () => Promise<T>
): Promise<{
  result: T;
  duration: number;
  cpuTime?: number;
}> {
  const startTime = performance.now();
  const startCpu = process.cpuUsage();

  const result = await fn();

  const duration = performance.now() - startTime;
  const cpuDelta = process.cpuUsage(startCpu);
  const cpuTime = (cpuDelta.user + cpuDelta.system) / 1000; // Convert to milliseconds

  return {
    result,
    duration,
    cpuTime,
  };
}

/**
 * Create a mock slow function for testing
 */
export function createSlowFunction(delayMs: number): () => Promise<void> {
  return () => new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Create a mock function that fails a certain percentage of the time
 */
export function createUnreliableFunction(
  failureRate: number,
  fn?: () => Promise<any>
): () => Promise<any> {
  return async () => {
    if (Math.random() < failureRate) {
      throw new Error('Simulated failure');
    }
    return fn ? fn() : Promise.resolve();
  };
}

/**
 * Format benchmark results for display
 */
export function formatBenchmarkResult(result: BenchmarkResult): string {
  return `
Benchmark Results:
  Iterations: ${result.iterations}
  Total Time: ${result.totalTime.toFixed(2)}ms
  Average: ${result.averageTime.toFixed(2)}ms
  Min: ${result.minTime.toFixed(2)}ms
  Max: ${result.maxTime.toFixed(2)}ms
  Median: ${result.medianTime.toFixed(2)}ms
  P95: ${result.p95Time.toFixed(2)}ms
  P99: ${result.p99Time.toFixed(2)}ms
  Ops/sec: ${result.operationsPerSecond.toFixed(2)}
  `.trim();
}

/**
 * Format load test results for display
 */
export function formatLoadTestResult(result: LoadTestResult): string {
  const successRate = (result.successfulRequests / result.totalRequests) * 100;

  let output = `
Load Test Results:
  Total Requests: ${result.totalRequests}
  Successful: ${result.successfulRequests} (${successRate.toFixed(2)}%)
  Failed: ${result.failedRequests}
  Duration: ${result.duration.toFixed(2)}ms
  Throughput: ${result.requestsPerSecond.toFixed(2)} req/s
  Response Times:
    Average: ${result.averageResponseTime.toFixed(2)}ms
    Min: ${result.minResponseTime.toFixed(2)}ms
    Max: ${result.maxResponseTime.toFixed(2)}ms
    P95: ${result.p95ResponseTime.toFixed(2)}ms
    P99: ${result.p99ResponseTime.toFixed(2)}ms
  `.trim();

  if (result.errors.length > 0) {
    output += '\n  Errors:';
    result.errors.forEach(({ message, count }) => {
      output += `\n    ${message}: ${count}`;
    });
  }

  return output;
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  checkIntervalMs = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }

  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}
