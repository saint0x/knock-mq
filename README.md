# Knock
A production-grade message queue implementation.

## Features

- **High Performance**: 354 jobs/sec enqueue rate with realistic processing
- **Production Ready**: Circuit breaker, retries, dead letter queue
- **Type Safe**: Full TypeScript support with comprehensive type definitions
- **Flexible Storage**: In-memory storage with extensible interface for other backends
- **Priority Queues**: Support for high, normal, and low priority jobs
- **Monitoring**: Built-in metrics and health monitoring
- **Realistic Testing**: Comprehensive test suite with production-like scenarios

## Installation

```bash
npm install knock
```

## Quick Start

```typescript
import { Queue, Storage } from 'knock-mq';

// Create a queue instance
const queue = new Queue({
  name: 'my-queue',
  storage: new Storage(),
  maxRetries: 3,
  maxConcurrent: 5,
  logger: console
});

// Add a job processor
queue.useProcessor(async (job) => {
  console.log('Processing job:', job.data);
  // Your job processing logic here
  return { success: true };
});

// Start processing
queue.start();

// Add jobs to the queue
await queue.enqueue({ message: 'Hello, World!' });
await queue.enqueue({ urgent: true }, { priority: 'high' });
```

## API Reference

### Queue

The main interface for interacting with the queue.

```typescript
import { Queue } from 'knock-mq';

const queue = new Queue({
  concurrency: 10,        // Number of concurrent jobs
  retryAttempts: 3,       // Retry failed jobs
  retryDelay: 1000,       // Delay between retries (ms)
  circuitBreakerThreshold: 5  // Circuit breaker failure threshold
});
```

#### Methods

- `add(jobType, data, options?)` - Add a job to the queue
- `process(jobType, processor)` - Register a job processor
- `start()` - Start processing jobs
- `stop()` - Stop processing jobs
- `pause()` - Pause the queue
- `resume()` - Resume the queue
- `getStats()` - Get queue statistics

### Queue

Low-level queue implementation for advanced use cases.

```typescript
import { Queue, InMemoryStorage } from 'knock';

const storage = new InMemoryStorage();
const queue = new Queue(storage, {
  concurrency: 5,
  retryAttempts: 3
});
```

### Storage

Extensible storage interface with in-memory implementation included.

```typescript
import { Storage } from 'knock-mq';

const storage = new Storage();
```

For other storage backends (PostgreSQL, Redis, etc.), see `storage.examples.md`.

## Job Priorities

Jobs can be assigned priorities to control processing order:

```typescript
await queue.add('important-task', data, { priority: 'high' });
await queue.add('normal-task', data, { priority: 'normal' });
await queue.add('background-task', data, { priority: 'low' });
```

## Error Handling

The queue includes comprehensive error handling:

- **Retries**: Failed jobs are automatically retried with exponential backoff
- **Circuit Breaker**: Prevents cascade failures by temporarily stopping processing
- **Dead Letter Queue**: Permanently failed jobs are moved to a dead letter queue

```typescript
// Access dead letter items
const deadLetterItems = await queue.getDeadLetterItems(10);
```

## Monitoring

Get real-time queue statistics:

```typescript
const stats = queue.getStats();
console.log({
  queued: stats.queued,
  processing: stats.processing,
  completed: stats.completed,
  failed: stats.failed
});
```

## Performance

Under realistic test conditions:
- **Enqueue Rate**: 354 jobs/sec
- **Processing Rate**: ~6 jobs/sec (limited by realistic CPU work)
- **P50 Latency**: 837ms
- **P99 Latency**: 135.9 seconds (under sustained load)
- **Success Rate**: 100% with proper error handling

## Testing

The package includes a comprehensive testing framework with realistic job scenarios:

```bash
npm test
```

See the `tests/` directory for detailed performance testing and monitoring capabilities.

## License

MIT

## Contributing

Contributions are welcome! Please see the [GitHub repository](https://github.com/saint0x/knock-mq) for more information.

## Advanced Usage

### Custom Storage Backend

```typescript
import { Queue, Storage } from 'knock-mq';

// Use the built-in in-memory storage
const storage = new Storage();

// Or implement your own storage (PostgreSQL, Redis, etc.)
class CustomStorage implements ExtendedQueueStorage {
  // Implement the storage interface
}

const queue = new Queue({
  name: 'production-queue',
  storage: new CustomStorage(),
  maxRetries: 5,
  backoffBaseMs: 2000,
  maxConcurrent: 20,
  timeoutMs: 60000,
  logger: yourLogger
});
```