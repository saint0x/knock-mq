import { Queue, Storage } from 'knock-mq';

// Production-like logger
const logger = {
  info: (msg: string, meta?: any) => console.log(`[${new Date().toISOString()}] [INFO] ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg: string, meta?: any) => console.log(`[${new Date().toISOString()}] [WARN] ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string, error: Error, meta?: any) => console.log(`[${new Date().toISOString()}] [ERROR] ${msg}`, error.message, meta ? JSON.stringify(meta) : '')
};

// Create storage and queue configuration
const storage = new Storage();
const queueConfig = {
  name: 'production-queue',
  maxRetries: 3,
  backoffBaseMs: 1000,
  maxConcurrent: 10,
  timeoutMs: 30000,
  logger,
  storage
};

// Initialize queue instance
const queue = new Queue(queueConfig);

// Job processors with realistic work simulation
queue.useProcessor(async (job) => {
  const start = Date.now();
  const { type, data } = job.data as { type: string; data: any };
  
  try {
    switch (type) {
      case 'email':
        // Simulate email processing
        await simulateEmailProcessing(data);
        break;
      case 'payment':
        // Simulate payment processing
        await simulatePaymentProcessing(data);
        break;
      case 'analytics':
        // Simulate analytics processing
        await simulateAnalyticsProcessing(data);
        break;
      case 'image':
        // Simulate image processing
        await simulateImageProcessing(data);
        break;
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
    
    const duration = Date.now() - start;
    logger.info(`✅ Processed ${type} job for ${data.userId} in ${duration}ms`);
    return { success: true };
    
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`❌ Failed ${type} job for ${data.userId} after ${duration}ms`, error as Error);
    return { success: false };
  }
});

// Realistic job processing simulations
async function simulateEmailProcessing(data: any) {
  // Simulate template rendering
  await sleep(Math.random() * 50 + 25);
  
  // Simulate SMTP connection
  await sleep(Math.random() * 100 + 50);
  
  // 5% chance of failure
  if (Math.random() < 0.05) {
    throw new Error('SMTP connection failed');
  }
}

async function simulatePaymentProcessing(data: any) {
  // Simulate fraud detection
  await sleep(Math.random() * 200 + 100);
  
  // Simulate payment gateway call
  await sleep(Math.random() * 300 + 200);
  
  // 8% chance of failure
  if (Math.random() < 0.08) {
    throw new Error('Payment gateway timeout');
  }
}

async function simulateAnalyticsProcessing(data: any) {
  // Simulate data aggregation
  const operations = Math.floor(Math.random() * 1000) + 500;
  let sum = 0;
  for (let i = 0; i < operations; i++) {
    sum += Math.random() * 100;
  }
  
  await sleep(Math.random() * 50 + 25);
  
  // 5% chance of failure
  if (Math.random() < 0.05) {
    throw new Error('Data validation failed');
  }
}

async function simulateImageProcessing(data: any) {
  // Simulate CPU-intensive image processing
  const pixels = Math.floor(Math.random() * 100000) + 50000;
  const imageData = new Array(pixels).fill(0).map(() => Math.random() * 255);
  
  // Apply blur filter (CPU intensive)
  for (let i = 1; i < imageData.length - 1; i++) {
    imageData[i] = (imageData[i-1] + imageData[i] + imageData[i+1]) / 3;
  }
  
  await sleep(Math.random() * 400 + 200);
  
  // 6% chance of failure
  if (Math.random() < 0.06) {
    throw new Error('Image processing failed');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate realistic job data
function generateJob(type: string) {
  const userId = `user-${Math.floor(Math.random() * 10000)}-${Math.random().toString(36).substr(2, 6)}`;
  
  const jobs = {
    email: {
      type: 'email',
      data: {
        userId,
        to: `${userId}@example.com`,
        template: ['welcome', 'newsletter', 'notification'][Math.floor(Math.random() * 3)],
        language: ['en', 'es', 'fr'][Math.floor(Math.random() * 3)]
      }
    },
    payment: {
      type: 'payment',
      data: {
        userId,
        amount: Math.floor(Math.random() * 10000) + 100,
        currency: 'USD',
        cardLast4: Math.floor(Math.random() * 9999).toString().padStart(4, '0')
      }
    },
    analytics: {
      type: 'analytics',
      data: {
        userId,
        event: ['page_view', 'click', 'conversion'][Math.floor(Math.random() * 3)],
        timestamp: new Date().toISOString(),
        metadata: { source: 'web', campaign: 'summer2024' }
      }
    },
    image: {
      type: 'image',
      data: {
        userId,
        imageId: `img-${Math.random().toString(36).substr(2, 8)}`,
        format: ['jpg', 'png', 'webp'][Math.floor(Math.random() * 3)],
        size: Math.floor(Math.random() * 5000000) + 100000
      }
    }
  };
  
  return jobs[type as keyof typeof jobs];
}

// Statistics tracking
let totalEnqueued = 0;
let startTime = Date.now();

// Stats display function
async function displayStats() {
  const stats = await queue.getStats();
  const runtime = (Date.now() - startTime) / 1000;
  const enqueueRate = totalEnqueued / runtime;
  const processingRate = (stats.totalProcessed || 0) / runtime;
  
  console.log('\n📊 PRODUCTION QUEUE STATISTICS');
  console.log('================================');
  console.log(`Runtime: ${runtime.toFixed(1)}s`);
  console.log(`Total Enqueued: ${totalEnqueued} jobs`);
  console.log(`Total Processed: ${stats.totalProcessed || 0} jobs`);
  console.log(`Currently Processing: ${stats.currentlyProcessing || 0} jobs`);
  console.log(`Total Errors: ${stats.totalErrors || 0} jobs`);
  console.log(`Enqueue Rate: ${enqueueRate.toFixed(1)} jobs/sec`);
  console.log(`Processing Rate: ${processingRate.toFixed(1)} jobs/sec`);
  console.log(`Average Processing Time: ${(stats.averageProcessingTime || 0).toFixed(1)}ms`);
  console.log(`Success Rate: ${(((stats.totalProcessed || 0) - (stats.totalErrors || 0)) / Math.max(stats.totalProcessed || 1, 1) * 100).toFixed(1)}%`);
  console.log('================================\n');
}

// Main test function
async function runProductionTest() {
  console.log('🚀 Starting Production Queue Test with knock-mq@0.0.1');
  console.log('📦 Package installed from npm registry');
  console.log('⚡ Using realistic job processing scenarios\n');
  
  // Start the queue
  queue.start();
  
  // Add initial batch of jobs
  const jobTypes = ['email', 'payment', 'analytics', 'image'];
  
  // Add jobs continuously
  const addJobs = async () => {
    for (let i = 0; i < 5; i++) {
      const type = jobTypes[Math.floor(Math.random() * jobTypes.length)];
      const job = generateJob(type);
      const priority = Math.random() < 0.1 ? 'high' : Math.random() < 0.2 ? 'low' : 'normal';
      
      await queue.enqueue(job, { priority: priority as any });
      totalEnqueued++;
    }
  };
  
  // Add jobs every 500ms
  const jobInterval = setInterval(addJobs, 500);
  
  // Display stats every 5 seconds
  const statsInterval = setInterval(() => displayStats().catch(console.error), 5000);
  
  // Initial stats display
  setTimeout(() => displayStats().catch(console.error), 2000);
  
  // Run for 30 seconds
  setTimeout(() => {
    clearInterval(jobInterval);
    
    // Let remaining jobs finish
    setTimeout(async () => {
      clearInterval(statsInterval);
      queue.stop();
      
      console.log('🏁 Production test completed!');
      await displayStats();
      
      // Show dead letter queue if any
      const deadLetters = await queue.getDeadLetters(10);
      if (deadLetters.length > 0) {
        console.log(`💀 Dead Letter Queue: ${deadLetters.length} failed jobs`);
        deadLetters.forEach(job => {
          console.log(`  - ${job.id}: ${job.metadata.error}`);
        });
      }
      
      process.exit(0);
    }, 5000);
  }, 30000);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Graceful shutdown initiated...');
  queue.stop();
  await displayStats();
  process.exit(0);
});

// Start the test
runProductionTest().catch(console.error); 