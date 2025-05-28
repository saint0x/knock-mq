import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { QueueInstance } from '../src/api';
import { InMemoryStorage } from '../src/storage';
import type { Logger } from '../src/queue';
import { MetricsCollector, analyzeBenchmarks } from './metrics';
import { 
  simulateEmailProcessing, 
  simulatePaymentProcessing, 
  simulateAnalyticsProcessing, 
  simulateImageProcessing, 
  simulateGenericProcessing 
} from './processor';
import { TestScenarios, type TestJob } from './scenarios';

// Enhanced logger with performance tracking
const logger: Logger = {
  info: (msg, meta) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${msg}`, meta || '');
  },
  warn: (msg, meta) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${msg}`, meta || '');
  },
  error: (msg, err, meta) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${msg}`, err.message, meta || '');
    metricsCollector.recordFailure();
  }
};

// Initialize metrics collector
const metricsCollector = new MetricsCollector();

// Initialize queue with realistic configuration
const storage = new InMemoryStorage<TestJob>();
const queue = new QueueInstance<TestJob>({
  name: 'realistic-test-queue',
  maxRetries: 3,
  backoffBaseMs: 100,
  maxConcurrent: 10,
  timeoutMs: 5000,
  logger,
  storage
});

// Realistic processor that handles actual work
queue.useProcessor(async (item) => {
  const processingStartTime = performance.now();
  const { data } = item;
  
  // Mark processing start for queue latency calculation
  if (data) {
    data.startedAt = Date.now();
  }
  
  // Perform realistic work based on job type
  try {
    switch (data?.type) {
      case 'email':
        await simulateEmailProcessing(data);
        break;
      case 'payment':
        await simulatePaymentProcessing(data);
        break;
      case 'analytics':
        await simulateAnalyticsProcessing(data);
        break;
      case 'image-processing':
        await simulateImageProcessing(data);
        break;
      default:
        await simulateGenericProcessing(data);
    }
  } catch (error) {
    // Realistic error handling
    throw error;
  }
  
  // Calculate actual processing time (including real work)
  const processingEndTime = performance.now();
  const actualProcessingTime = processingEndTime - processingStartTime;
  
  if (data) {
    data.completedAt = Date.now();
  }
  
  // Record metrics
  metricsCollector.recordProcessingTime(actualProcessingTime);
  metricsCollector.recordSuccess();
  
  // Calculate realistic queue latency (enqueue to completion)
  if (data?.enqueuedAt && data?.completedAt) {
    const queueLatency = data.completedAt - data.enqueuedAt;
    metricsCollector.recordLatency(queueLatency);
  }
  
  logger.info(`✅ Processed ${data?.type || 'unknown'} job for ${data?.userId || 'unknown'} in ${actualProcessingTime.toFixed(2)}ms`);
  return { success: true };
});

// Start processing
queue.start();

const app = new Hono();

// Health check with performance summary
app.get('/health', (c) => {
  const stats = metricsCollector.getFormattedStats();
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: stats.uptime,
    totalProcessed: stats.totalJobs,
    currentThroughput: stats.currentThroughput
  });
});

// Comprehensive performance stats
app.get('/stats', async (c) => {
  const queueStats = await queue.getStats();
  const isPaused = await queue.isPaused();
  const performanceStats = metricsCollector.getFormattedStats();
  
  return c.json({
    // Queue stats
    ...queueStats,
    isPaused,
    
    // Performance metrics
    performance: performanceStats
  });
});

// Industry benchmark comparison with realistic workloads
app.get('/benchmarks', (c) => {
  const metrics = metricsCollector.getMetrics();
  const analysis = analyzeBenchmarks(metrics);
  
  return c.json(analysis);
});

// Enhanced monitoring with real-time metrics
app.get('/monitor', async (c) => {
  const stats = await queue.getStats();
  const deadLetters = await queue.getDeadLetters(10);
  const isPaused = await queue.isPaused();
  const metrics = metricsCollector.getMetrics();
  
  return c.json({
    timestamp: new Date().toISOString(),
    stats,
    isPaused,
    deadLetterCount: deadLetters.length,
    recentDeadLetters: deadLetters.slice(0, 3),
    
    // Real-time performance
    realTimeMetrics: {
      currentThroughput: `${metrics.averageThroughput.toFixed(1)} jobs/sec`,
      recentThroughputHistory: metrics.throughputSamples.slice(-12).map(s => ({
        time: new Date(s.timestamp).toISOString(),
        processed: s.processed
      })),
      memoryUsage: process.memoryUsage(),
      activeConnections: 1
    }
  });
});

// Enhanced enqueue with timing
app.post('/enqueue', async (c) => {
  const enqueueStart = performance.now();
  const body = await c.req.json();
  const { type, userId, data, priority } = body;
  
  const jobData: TestJob = {
    type: type || 'analytics',
    userId: userId || `user-${Math.random().toString(36).substr(2, 9)}`,
    data: data || {},
    enqueuedAt: Date.now()
  };
  
  const id = await queue.enqueue(jobData, { priority });
  const enqueueTime = performance.now() - enqueueStart;
  
  metricsCollector.recordEnqueueTime(enqueueTime);
  
  return c.json({ 
    id, 
    message: 'Job enqueued successfully',
    enqueueTime: `${enqueueTime.toFixed(2)}ms`
  });
});

// Realistic test scenarios
app.post('/test/burst', async (c) => {
  const { count = 100 } = await c.req.json();
  
  const result = await TestScenarios.runBurstTest(async (job: TestJob) => {
    return await queue.enqueue(job);
  }, count);
  
  return c.json({
    message: `Realistic burst test completed: ${count} jobs`,
    ...result,
    jobs: result.jobs.slice(0, 10) // Only return first 10 IDs
  });
});

app.post('/test/throughput', async (c) => {
  const { duration = 30000, jobsPerSecond = 50 } = await c.req.json();
  
  // Start the test (non-blocking)
  TestScenarios.runThroughputTest(async (job: TestJob) => {
    return await queue.enqueue(job);
  }, duration, jobsPerSecond);
  
  return c.json({ 
    message: `Realistic throughput test started: ${jobsPerSecond} jobs/sec for ${duration/1000}s`,
    expectedJobs: Math.floor((duration / 1000) * jobsPerSecond)
  });
});

app.post('/test/latency', async (c) => {
  const { count = 50 } = await c.req.json();
  
  const result = await TestScenarios.runLatencyTest(async (job: TestJob) => {
    return await queue.enqueue(job);
  }, count);
  
  return c.json({
    message: `Realistic latency test completed: ${count} jobs`,
    note: "Check /stats for latency percentiles as jobs complete",
    jobs: result.jobs.slice(0, 5)
  });
});

app.post('/test/mixed-workload', async (c) => {
  const { duration = 60000 } = await c.req.json();
  
  // Start the test (non-blocking)
  TestScenarios.runMixedWorkloadTest(async (job: TestJob) => {
    return await queue.enqueue(job);
  }, duration);
  
  return c.json({ 
    message: `Mixed workload test started for ${duration/1000}s`,
    note: "Simulates realistic traffic patterns with peak hours"
  });
});

app.post('/test/error-scenarios', async (c) => {
  const { count = 100 } = await c.req.json();
  
  const result = await TestScenarios.runErrorScenarioTest(async (job: TestJob) => {
    return await queue.enqueue(job);
  }, count);
  
  return c.json({
    message: `Error scenario test completed: ${count} jobs with various failure modes`,
    jobs: result.jobs.slice(0, 10)
  });
});

app.post('/test/priority', async (c) => {
  const result = await TestScenarios.runPriorityTest(async (job: TestJob, priority?: string) => {
    return await queue.enqueue(job, { priority: priority as any });
  });
  
  return c.json({
    message: "Priority test completed: 160 jobs with mixed priorities",
    jobs: result.jobs.slice(0, 10)
  });
});

// Performance reset endpoint
app.post('/reset-metrics', (c) => {
  metricsCollector.reset();
  logger.info('📊 Performance metrics reset');
  
  return c.json({ message: 'Performance metrics reset' });
});

// Other existing endpoints...
app.get('/job/:id', async (c) => {
  const id = c.req.param('id');
  const status = await queue.getStatus(id);
  return c.json({ id, status });
});

app.get('/dead-letters', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const items = await queue.getDeadLetters(limit);
  return c.json({ items, count: items.length });
});

app.post('/pause', async (c) => {
  await queue.pause();
  logger.info('⏸️  Queue paused');
  return c.json({ message: 'Queue paused' });
});

app.post('/resume', async (c) => {
  await queue.resume();
  logger.info('▶️  Queue resumed');
  return c.json({ message: 'Queue resumed' });
});

console.log('🚀 Realistic Production-Grade Message Queue Test Server');
console.log('');
console.log('📊 Core Endpoints:');
console.log('  GET  /health - Health check with performance summary');
console.log('  GET  /stats - Comprehensive performance statistics');
console.log('  GET  /benchmarks - Industry benchmark comparison (realistic workloads)');
console.log('  GET  /monitor - Real-time metrics and monitoring');
console.log('');
console.log('🧪 Realistic Test Scenarios:');
console.log('  POST /test/burst - Realistic burst load test');
console.log('  POST /test/throughput - Sustained throughput with realistic jobs');
console.log('  POST /test/latency - Latency measurement with realistic processing');
console.log('  POST /test/mixed-workload - Mixed workload with traffic patterns');
console.log('  POST /test/error-scenarios - Error handling and recovery testing');
console.log('  POST /test/priority - Priority queue testing');
console.log('  POST /reset-metrics - Reset performance counters');
console.log('');
console.log('⚡ What Makes This Realistic:');
console.log('  • Actual CPU work (image processing, calculations, validation)');
console.log('  • Network simulation (API calls, database operations)');
console.log('  • Realistic error rates and failure modes');
console.log('  • Production-like job payloads and processing patterns');
console.log('  • Memory allocation patterns similar to real applications');
console.log('');
console.log('📈 All metrics now reflect REALISTIC production workloads');
console.log('   (not artificial delays or toy examples)');
console.log('');

const port = 3000;
serve({
  fetch: app.fetch,
  port
});

console.log(`🎯 Server running on http://localhost:${port}`);
console.log('💡 Quick start: curl http://localhost:3000/benchmarks');
console.log('🧪 Realistic test: curl -X POST http://localhost:3000/test/burst -H "Content-Type: application/json" -d \'{"count":100}\''); 