// Realistic test scenarios for production-grade queue testing

export interface TestJob {
  type: 'email' | 'payment' | 'analytics' | 'image-processing';
  userId: string;
  data: any;
  enqueuedAt?: number;
  startedAt?: number;
  completedAt?: number;
}

export class TestScenarios {
  
  static generateRealisticJob(index: number): TestJob {
    const types: TestJob['type'][] = ['email', 'payment', 'analytics', 'image-processing'];
    const randomIndex = Math.floor(Math.random() * types.length);
    const type = types[randomIndex] || 'analytics'; // Fallback to analytics if undefined
    
    return {
      type,
      userId: `user-${index}-${Math.random().toString(36).substr(2, 6)}`,
      data: this.generateJobData(type, index),
      enqueuedAt: Date.now()
    };
  }

  private static generateJobData(type: TestJob['type'], index: number) {
    switch (type) {
      case 'email':
        return {
          template: ['welcome', 'notification', 'marketing', 'transactional'][Math.floor(Math.random() * 4)],
          recipient: `user${index}@example.com`,
          subject: `Test Email ${index}`,
          variables: {
            name: `User ${index}`,
            timestamp: new Date().toISOString(),
            data: Array(50).fill(0).map((_, i) => `item-${i}`)
          }
        };
      
      case 'payment':
        return {
          amount: Math.floor(Math.random() * 10000) / 100, // $0.01 to $100.00
          currency: 'USD',
          paymentMethod: 'card',
          cardLast4: '1234',
          merchantId: `merchant-${Math.floor(Math.random() * 1000)}`,
          metadata: {
            orderId: `order-${index}`,
            customerId: `customer-${Math.floor(Math.random() * 5000)}`,
            items: Array(Math.floor(Math.random() * 5) + 1).fill(0).map((_, i) => ({
              id: `item-${i}`,
              price: Math.floor(Math.random() * 5000) / 100
            }))
          }
        };
      
      case 'analytics':
        return {
          event: ['page_view', 'click', 'purchase', 'signup', 'login'][Math.floor(Math.random() * 5)],
          timestamp: Date.now(),
          sessionId: `session-${Math.random().toString(36).substr(2, 10)}`,
          properties: {
            page: `/page-${Math.floor(Math.random() * 100)}`,
            referrer: Math.random() > 0.5 ? 'google.com' : 'direct',
            userAgent: 'Mozilla/5.0 (compatible; TestBot/1.0)',
            ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            customData: Array(20).fill(0).reduce((acc, _, i) => {
              acc[`prop_${i}`] = Math.random() * 1000;
              return acc;
            }, {} as Record<string, number>)
          }
        };
      
      case 'image-processing':
        return {
          imageUrl: `https://example.com/images/image-${index}.jpg`,
          operations: [
            { type: 'resize', width: 800, height: 600 },
            { type: 'compress', quality: 85 },
            { type: 'watermark', text: 'Test Watermark' }
          ],
          outputFormats: ['webp', 'jpg', 'png'],
          metadata: {
            originalSize: Math.floor(Math.random() * 10000000), // 0-10MB
            uploadedBy: `user-${index}`,
            tags: Array(5).fill(0).map((_, i) => `tag-${i}`)
          }
        };
      
      default:
        return { index, timestamp: Date.now() };
    }
  }

  static async runBurstTest(
    enqueueFunction: (job: TestJob) => Promise<string>,
    count: number = 100
  ): Promise<{ jobs: string[], timing: any }> {
    const startTime = performance.now();
    const jobs: string[] = [];
    
    console.log(`🚀 Starting realistic burst test: ${count} jobs`);
    
    for (let i = 0; i < count; i++) {
      const job = this.generateRealisticJob(i);
      const id = await enqueueFunction(job);
      jobs.push(id);
    }
    
    const totalTime = performance.now() - startTime;
    const enqueueRate = count / (totalTime / 1000);
    
    console.log(`✅ Burst test completed: ${count} jobs in ${totalTime.toFixed(2)}ms (${enqueueRate.toFixed(1)} jobs/sec)`);
    
    return {
      jobs,
      timing: {
        totalTime: `${totalTime.toFixed(2)}ms`,
        enqueueRate: `${enqueueRate.toFixed(1)} jobs/sec`,
        avgTimePerJob: `${(totalTime / count).toFixed(2)}ms`
      }
    };
  }

  static async runThroughputTest(
    enqueueFunction: (job: TestJob) => Promise<string>,
    duration: number = 30000,
    jobsPerSecond: number = 50
  ): Promise<void> {
    const interval = 1000 / jobsPerSecond;
    const startTime = Date.now();
    let jobCount = 0;
    
    console.log(`🔥 Starting realistic throughput test: ${jobsPerSecond} jobs/sec for ${duration/1000}s`);
    
    const testInterval = setInterval(async () => {
      if (Date.now() - startTime > duration) {
        clearInterval(testInterval);
        const actualDuration = (Date.now() - startTime) / 1000;
        const actualRate = jobCount / actualDuration;
        
        console.log(`✅ Throughput test completed: ${jobCount} jobs in ${actualDuration.toFixed(1)}s (${actualRate.toFixed(1)} jobs/sec)`);
        return;
      }
      
      const job = this.generateRealisticJob(jobCount);
      await enqueueFunction(job);
      jobCount++;
    }, interval);
  }

  static async runLatencyTest(
    enqueueFunction: (job: TestJob) => Promise<string>,
    count: number = 50
  ): Promise<{ jobs: Array<{ id: string; enqueuedAt: number }> }> {
    const results: Array<{ id: string; enqueuedAt: number }> = [];
    
    console.log(`⏱️  Starting realistic latency test: ${count} sequential jobs`);
    
    for (let i = 0; i < count; i++) {
      const enqueueTime = Date.now();
      const job = this.generateRealisticJob(i);
      
      const id = await enqueueFunction(job);
      
      // Small delay to spread out jobs
      await new Promise(resolve => setTimeout(resolve, 20));
      
      results.push({ id, enqueuedAt: enqueueTime });
    }
    
    console.log(`✅ Latency test jobs enqueued: ${count} jobs`);
    
    return { jobs: results };
  }

  static async runMixedWorkloadTest(
    enqueueFunction: (job: TestJob) => Promise<string>,
    duration: number = 60000
  ): Promise<void> {
    const startTime = Date.now();
    let jobCount = 0;
    
    console.log(`🎯 Starting mixed workload test for ${duration/1000}s`);
    
    const testInterval = setInterval(async () => {
      if (Date.now() - startTime > duration) {
        clearInterval(testInterval);
        const actualDuration = (Date.now() - startTime) / 1000;
        const actualRate = jobCount / actualDuration;
        
        console.log(`✅ Mixed workload test completed: ${jobCount} jobs in ${actualDuration.toFixed(1)}s (${actualRate.toFixed(1)} jobs/sec)`);
        return;
      }
      
      // Simulate realistic traffic patterns
      const hour = new Date().getHours();
      let jobsThisSecond = 1;
      
      // Simulate peak hours (9-17) with higher load
      if (hour >= 9 && hour <= 17) {
        jobsThisSecond = Math.floor(Math.random() * 5) + 2; // 2-6 jobs
      } else {
        jobsThisSecond = Math.floor(Math.random() * 2) + 1; // 1-2 jobs
      }
      
      // Enqueue multiple jobs this second
      for (let i = 0; i < jobsThisSecond; i++) {
        const job = this.generateRealisticJob(jobCount + i);
        await enqueueFunction(job);
      }
      
      jobCount += jobsThisSecond;
    }, 1000); // Every second
  }

  static async runErrorScenarioTest(
    enqueueFunction: (job: TestJob) => Promise<string>,
    count: number = 100
  ): Promise<{ jobs: string[] }> {
    const jobs: string[] = [];
    
    console.log(`💥 Starting error scenario test: ${count} jobs with various failure modes`);
    
    for (let i = 0; i < count; i++) {
      const job = this.generateRealisticJob(i);
      
      // Inject various error scenarios
      if (i % 10 === 0) {
        // Invalid payment amount
        if (job.type === 'payment') {
          job.data.amount = -100;
        }
      }
      
      if (i % 15 === 0) {
        // Missing required fields
        delete job.data.userId;
      }
      
      if (i % 20 === 0) {
        // Simulate large payload
        job.data.largeData = Array(10000).fill('x').join('');
      }
      
      const id = await enqueueFunction(job);
      jobs.push(id);
    }
    
    console.log(`✅ Error scenario test jobs enqueued: ${count} jobs`);
    
    return { jobs };
  }

  static async runPriorityTest(
    enqueueFunction: (job: TestJob, priority?: string) => Promise<string>
  ): Promise<{ jobs: Array<{ id: string; priority: string }> }> {
    const jobs: Array<{ id: string; priority: string }> = [];
    
    console.log(`🎯 Starting priority test with mixed priority jobs`);
    
    // High priority jobs (urgent payments)
    for (let i = 0; i < 10; i++) {
      const job: TestJob = {
        type: 'payment',
        userId: `priority-user-${i}`,
        data: { amount: 1000 + i, urgent: true },
        enqueuedAt: Date.now()
      };
      
      const id = await enqueueFunction(job, 'high');
      jobs.push({ id, priority: 'high' });
    }
    
    // Normal priority jobs (regular emails)
    for (let i = 0; i < 50; i++) {
      const job: TestJob = {
        type: 'email',
        userId: `normal-user-${i}`,
        data: { template: 'welcome', batch: true },
        enqueuedAt: Date.now()
      };
      
      const id = await enqueueFunction(job, 'normal');
      jobs.push({ id, priority: 'normal' });
    }
    
    // Low priority jobs (background analytics)
    for (let i = 0; i < 100; i++) {
      const job: TestJob = {
        type: 'analytics',
        userId: `analytics-user-${i}`,
        data: { event: 'page_view', background: true },
        enqueuedAt: Date.now()
      };
      
      const id = await enqueueFunction(job, 'low');
      jobs.push({ id, priority: 'low' });
    }
    
    console.log(`✅ Priority test completed: 160 jobs with mixed priorities`);
    
    return { jobs };
  }
} 