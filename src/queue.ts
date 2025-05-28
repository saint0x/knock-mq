import { EventEmitter } from 'events';

// === TYPES & INTERFACES ===

export type QueuePriority = 'high' | 'normal' | 'low';
export type QueueStatus =
  | 'queued'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'undeliverable'
  | 'cancelled';

export interface QueueItem<T = unknown> {
  id: string;
  priority: QueuePriority;
  data: T;
  metadata: {
    attempts: number;
    status: QueueStatus;
    queuedAt: Date;
    lastAttemptAt?: Date;
    nextAttemptAt?: Date;
    error?: string;
    expiresAt?: Date;
  };
}

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error: Error, meta?: any): void;
}

export interface Monitoring {
  trackError(error: Error, context?: Record<string, any>): void;
}

export interface QueueStorage<T = unknown> {
  enqueue(item: QueueItem<T>): Promise<void>;
  updateStatus(id: string, status: QueueStatus): Promise<void>;
  complete(id: string, success: boolean): Promise<void>;
  moveToDeadLetter(id: string, reason: string): Promise<void>;
  getProcessingCounts(): Promise<Record<QueuePriority, number>>;
  findStuckProcessing(since: Date): Promise<QueueItem<T>[]>;
}

// === CIRCUIT BREAKER ===

class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;

  constructor(
    private readonly threshold: number,
    private readonly timeout: number,
    private readonly logger: Logger
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailure = Date.now();
      this.logger.warn('Circuit breaker failure', { failures: this.failures });
      throw err;
    }
  }

  private isOpen(): boolean {
    return this.failures >= this.threshold &&
      Date.now() - this.lastFailure < this.timeout;
  }
}

// === QUEUE CLASS ===

export interface QueueConfig<T> {
  name: string;
  maxRetries: number;
  backoffBaseMs: number;
  maxConcurrent: number;
  priorityConfig?: Record<QueuePriority, number>;
  timeoutMs: number;
  logger: Logger;
  monitoring?: Monitoring;
  storage: QueueStorage<T>;
}

export class Queue<T> extends EventEmitter {
  private processing = new Map<string, { item: QueueItem<T>; startedAt: Date; timeout?: NodeJS.Timeout }>();
  private stats = {
    totalProcessed: 0,
    totalErrors: 0,
    processingTimes: [] as number[],
    seen: new Set<string>() // for deduplication
  };

  private circuitBreaker: CircuitBreaker;
  private paused = false;

  constructor(private readonly config: QueueConfig<T>) {
    super();
    const { maxConcurrent, priorityConfig } = config;

    this.circuitBreaker = new CircuitBreaker(5, 30000, config.logger);

    setInterval(() => this.cleanupStuckItems(), 60_000);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  async enqueue(
    data: T,
    opts: { id?: string; priority?: QueuePriority } = {}
  ): Promise<string> {
    const item: QueueItem<T> = {
      id: opts.id || crypto.randomUUID(),
      priority: opts.priority || 'normal',
      data,
      metadata: {
        attempts: 0,
        status: 'queued',
        queuedAt: new Date()
      }
    };

    await this.config.storage.enqueue(item);
    return item.id;
  }

  async processNext(
    processor: (item: QueueItem<T>) => Promise<{ success: boolean }>
  ): Promise<void> {
    if (this.paused) return;

    const stuckCutoff = new Date(Date.now() - this.config.timeoutMs * 2);
    const stuck = await this.config.storage.findStuckProcessing(stuckCutoff);

    for (const item of stuck) {
      await this.config.storage.updateStatus(item.id, 'failed');
    }

    const capacity = await this.hasCapacity();
    if (!capacity) return;

    // You'd normally fetch eligible items from DB here — in a real impl, `dequeue()` logic would be in storage

    // For now, assume processor is attached externally via `start()` loop
  }

  async processItem(
    item: QueueItem<T>,
    processor: (item: QueueItem<T>) => Promise<{ success: boolean }>
  ): Promise<void> {
    if (this.processing.has(item.id)) return;

    const start = Date.now();
    this.processing.set(item.id, {
      item,
      startedAt: new Date(),
      timeout: setTimeout(() => this.handleTimeout(item.id), this.config.timeoutMs)
    });

    try {
      item.metadata.status = 'processing';
      item.metadata.lastAttemptAt = new Date();
      await this.config.storage.updateStatus(item.id, 'processing');

      const result = await this.circuitBreaker.execute(() => processor(item));

      if (result.success) {
        await this.config.storage.complete(item.id, true);
        item.metadata.status = 'delivered';
        this.emit('itemDelivered', item);
      } else {
        await this.handleFailure(item, processor);
      }

      if (!this.stats.seen.has(item.id)) {
        this.stats.totalProcessed++;
        this.stats.seen.add(item.id);
      }
      this.stats.processingTimes.push(Date.now() - start);

    } catch (err) {
      await this.handleError(item, err as Error, processor);
    } finally {
      this.clearProcessing(item.id);
    }
  }

  private async handleFailure(
    item: QueueItem<T>,
    processor: (item: QueueItem<T>) => Promise<{ success: boolean }>
  ) {
    item.metadata.attempts++;
    item.metadata.status = 'failed';

    if (item.metadata.attempts >= this.config.maxRetries) {
      await this.config.storage.moveToDeadLetter(item.id, 'max_retries');
      item.metadata.status = 'undeliverable';
      this.emit('itemUndeliverable', item);
      return;
    }

    const backoff = this.calculateBackoff(item.metadata.attempts);
    item.metadata.nextAttemptAt = new Date(Date.now() + backoff);
    item.metadata.status = 'queued';

    await this.config.storage.updateStatus(item.id, 'queued');
    this.emit('itemRetryScheduled', item);
  }

  private async handleError(
    item: QueueItem<T>,
    err: Error,
    processor: (item: QueueItem<T>) => Promise<{ success: boolean }>
  ) {
    item.metadata.error = err.message;
    this.stats.totalErrors++;

    this.config.monitoring?.trackError(err, {
      itemId: item.id,
      attempt: item.metadata.attempts
    });

    await this.handleFailure(item, processor);
  }

  private async handleTimeout(id: string) {
    const info = this.processing.get(id);
    if (!info) return;

    await this.config.storage.updateStatus(id, 'failed');
    this.emit('itemTimeout', info.item);
    this.clearProcessing(id);
  }

  private clearProcessing(id: string) {
    const info = this.processing.get(id);
    if (info?.timeout) clearTimeout(info.timeout);
    this.processing.delete(id);
  }

  private calculateBackoff(attempt: number): number {
    return Math.min(this.config.backoffBaseMs * Math.pow(2, attempt - 1), 30_000);
  }

  private async hasCapacity(): Promise<boolean> {
    const current = await this.config.storage.getProcessingCounts();
    const { priorityConfig = { high: 5, normal: 3, low: 2 } } = this.config;

    return (
      (current.high || 0) < priorityConfig.high ||
      (current.normal || 0) < priorityConfig.normal ||
      (current.low || 0) < priorityConfig.low
    );
  }

  private async cleanupStuckItems() {
    const stuckCutoff = new Date(Date.now() - this.config.timeoutMs * 2);
    const stuck = await this.config.storage.findStuckProcessing(stuckCutoff);

    for (const item of stuck) {
      await this.config.storage.updateStatus(item.id, 'failed');
      this.emit('itemStuck', item);
    }
  }

  getStats() {
    return {
      totalProcessed: this.stats.totalProcessed,
      totalErrors: this.stats.totalErrors,
      averageProcessingTime: this.stats.processingTimes.length > 0 
        ? this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length 
        : 0,
      currentlyProcessing: this.processing.size
    };
  }
}
