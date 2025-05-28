import type {
  QueueItem,
  QueuePriority,
  QueueStatus
} from './queue.js';

export interface ExtendedQueueStorage<T = unknown> {
  enqueue(item: QueueItem<T>): Promise<void>;
  enqueueOnce(id: string, data: T, opts?: Partial<QueueItem<T>>): Promise<boolean>;
  updateStatus(id: string, status: QueueStatus): Promise<void>;
  complete(id: string, success: boolean): Promise<void>;
  moveToDeadLetter(id: string, reason: string): Promise<void>;
  getProcessingCounts(): Promise<Record<QueuePriority, number>>;
  findStuckProcessing(since: Date): Promise<QueueItem<T>[]>;
  dequeue(limit: number): Promise<QueueItem<T>[]>;
  getDeadLetterItems(limit: number): Promise<QueueItem<T>[]>;
  getItem(id: string): Promise<QueueItem<T> | null>;
  isPaused(): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export class InMemoryStorage<T = unknown> implements ExtendedQueueStorage<T> {
  private items = new Map<string, QueueItem<T>>();
  private paused = false;

  async enqueue(item: QueueItem<T>): Promise<void> {
    this.items.set(item.id, item);
  }

  async enqueueOnce(id: string, data: T, opts: Partial<QueueItem<T>> = {}): Promise<boolean> {
    if (this.items.has(id)) return false;

    const item: QueueItem<T> = {
      id,
      priority: opts.priority || 'normal',
      data,
      metadata: {
        attempts: 0,
        status: 'queued',
        queuedAt: new Date(),
        ...opts.metadata
      }
    };

    await this.enqueue(item);
    return true;
  }

  async updateStatus(id: string, status: QueueStatus): Promise<void> {
    const item = this.items.get(id);
    if (item) item.metadata.status = status;
  }

  async complete(id: string, _success: boolean): Promise<void> {
    const item = this.items.get(id);
    if (item) item.metadata.status = 'delivered';
  }

  async moveToDeadLetter(id: string, reason: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      item.metadata.status = 'undeliverable';
      item.metadata.error = reason;
    }
  }

  async getProcessingCounts(): Promise<Record<QueuePriority, number>> {
    const counts: Record<QueuePriority, number> = {
      high: 0,
      normal: 0,
      low: 0
    };

    for (const item of this.items.values()) {
      if (item.metadata.status === 'processing') {
        counts[item.priority]++;
      }
    }

    return counts;
  }

  async findStuckProcessing(since: Date): Promise<QueueItem<T>[]> {
    return Array.from(this.items.values()).filter(item =>
      item.metadata.status === 'processing' &&
      item.metadata.lastAttemptAt &&
      item.metadata.lastAttemptAt.getTime() < since.getTime()
    );
  }

  async dequeue(limit: number): Promise<QueueItem<T>[]> {
    const now = Date.now();

    const ready = Array.from(this.items.values())
      .filter(item =>
        item.metadata.status === 'queued' &&
        (!item.metadata.nextAttemptAt || item.metadata.nextAttemptAt.getTime() <= now) &&
        (!item.metadata.expiresAt || item.metadata.expiresAt.getTime() > now)
      )
      .sort((a, b) => {
        const pri = priorityScore(a.priority) - priorityScore(b.priority);
        return pri !== 0 ? pri : a.metadata.queuedAt.getTime() - b.metadata.queuedAt.getTime();
      });

    return ready.slice(0, limit);
  }

  async getDeadLetterItems(limit: number): Promise<QueueItem<T>[]> {
    return Array.from(this.items.values())
      .filter(item => item.metadata.status === 'undeliverable')
      .slice(0, limit);
  }

  async getItem(id: string): Promise<QueueItem<T> | null> {
    return this.items.get(id) || null;
  }

  async isPaused(): Promise<boolean> {
    return this.paused;
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  async resume(): Promise<void> {
    this.paused = false;
  }
}

function priorityScore(priority: QueuePriority): number {
  return priority === 'high' ? 1 : priority === 'normal' ? 2 : 3;
}
