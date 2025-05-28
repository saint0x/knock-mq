// Main exports for the knock message queue package
export { Queue as CoreQueue } from './queue.js';
export type { 
  QueueItem, 
  QueuePriority, 
  QueueStatus, 
  QueueConfig,
  Logger,
  Monitoring
} from './queue.js';

export { InMemoryStorage, InMemoryStorage as Storage } from './storage.js';
export type { 
  ExtendedQueueStorage 
} from './storage.js';

export { QueueInstance, QueueInstance as Queue } from './api.js';

// Re-export everything for convenience
export * from './queue.js';
export * from './storage.js';
export * from './api.js';
