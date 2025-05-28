import { Queue } from './queue';
import type { QueueConfig, QueueItem, QueueStatus, QueuePriority } from './queue';
import type { ExtendedQueueStorage } from './storage';

export class QueueInstance<T = unknown> {
  private queue: Queue<T>;
  private processor?: (item: QueueItem<T>) => Promise<{ success: boolean }>;
  private running = false;
  private pollInterval = 1000;

  constructor(private readonly config: Omit<QueueConfig<T>, 'storage'> & { storage: ExtendedQueueStorage<T> }) {
    this.queue = new Queue({
      ...config,
      storage: config.storage
    });
  }

  useProcessor(fn: (item: QueueItem<T>) => Promise<{ success: boolean }>) {
    this.processor = fn;
  }

  async enqueue(data: T, opts?: { id?: string; priority?: QueuePriority }): Promise<string> {
    return this.queue.enqueue(data, opts);
  }

  async enqueueOnce(id: string, data: T, opts?: { priority?: QueuePriority; expiresAt?: Date }): Promise<boolean> {
    return this.config.storage.enqueueOnce(id, data, {
      priority: opts?.priority || 'normal',
      metadata: {
        attempts: 0,
        status: 'queued' as QueueStatus,
        queuedAt: new Date(),
        ...(opts?.expiresAt ? { expiresAt: opts.expiresAt } : {})
      }
    });
  }

  async getDeadLetters(limit = 50): Promise<QueueItem<T>[]> {
    return this.config.storage.getDeadLetterItems(limit);
  }

  async pause(): Promise<void> {
    return this.config.storage.pause();
  }

  async resume(): Promise<void> {
    return this.config.storage.resume();
  }

  async isPaused(): Promise<boolean> {
    return this.config.storage.isPaused();
  }

  async start() {
    if (!this.processor) throw new Error('No processor attached');
    this.running = true;

    const { storage } = this.config;

    const loop = async () => {
      if (!this.running) return;

      if (await storage.isPaused()) {
        setTimeout(loop, this.pollInterval);
        return;
      }

      const items = await storage.dequeue(this.config.maxConcurrent);
      for (const item of items) {
        void this.queue.processItem(item, this.processor!);
      }

      setTimeout(loop, this.pollInterval);
    };

    loop();
  }

  stop() {
    this.running = false;
  }

  async getStats() {
    return this.queue.getStats();
  }

  async getStatus(id: string): Promise<QueueStatus | null> {
    const item = await this.config.storage.getItem(id);
    return item?.metadata.status || null;
  }
}
