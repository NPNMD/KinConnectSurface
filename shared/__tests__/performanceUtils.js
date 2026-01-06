"use strict";
/**
 * Performance Testing Utilities
 *
 * Helper functions for performance testing, benchmarking,
 * and performance assertions in tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.benchmark = benchmark;
exports.compareBenchmarks = compareBenchmarks;
exports.loadTest = loadTest;
exports.assertPerformance = assertPerformance;
exports.assertAveragePerformance = assertAveragePerformance;
exports.measureMemory = measureMemory;
exports.profile = profile;
exports.createSlowFunction = createSlowFunction;
exports.createUnreliableFunction = createUnreliableFunction;
exports.formatBenchmarkResult = formatBenchmarkResult;
exports.formatLoadTestResult = formatLoadTestResult;
exports.waitFor = waitFor;
/**
 * Benchmark a function
 */
async function benchmark(fn, config = {}) {
    const { iterations = 100, warmupIterations = 10, maxDuration = 30000, } = config;
    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
        await fn();
    }
    // Benchmark phase
    const times = [];
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
function compareBenchmarks(baseline, current) {
    const percentDifference = ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100;
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
async function loadTest(fn, config) {
    const { concurrency, duration, iterations, rampUpTime = 0, } = config;
    const results = [];
    const errors = new Map();
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
            }
            catch (error) {
                const requestTime = performance.now() - requestStart;
                results.push({ time: requestTime, success: false, error: error });
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
function assertPerformance(actualTime, maxTime, message) {
    if (actualTime > maxTime) {
        throw new Error(message ||
            `Performance assertion failed: ${actualTime}ms > ${maxTime}ms (${actualTime - maxTime}ms over threshold)`);
    }
}
/**
 * Assert average performance across multiple runs
 */
async function assertAveragePerformance(fn, maxAverageTime, iterations = 10, message) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        const time = performance.now() - start;
        times.push(time);
    }
    const average = times.reduce((sum, t) => sum + t, 0) / times.length;
    if (average > maxAverageTime) {
        throw new Error(message ||
            `Average performance assertion failed: ${average.toFixed(2)}ms > ${maxAverageTime}ms`);
    }
}
/**
 * Measure memory usage before and after an operation
 */
async function measureMemory(fn) {
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
async function profile(fn) {
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
function createSlowFunction(delayMs) {
    return () => new Promise((resolve) => setTimeout(resolve, delayMs));
}
/**
 * Create a mock function that fails a certain percentage of the time
 */
function createUnreliableFunction(failureRate, fn) {
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
function formatBenchmarkResult(result) {
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
function formatLoadTestResult(result) {
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
async function waitFor(condition, timeoutMs = 5000, checkIntervalMs = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (await condition()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
    }
    throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}
