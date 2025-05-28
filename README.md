# 🧵 knock-mq — Priority-Aware, Retry-Safe Message Queue for Node.js/Bun

**`knock-mq`** is a lightweight, embeddable message queue engine with:
- Persistent pluggable storage
- Retry logic + exponential backoff
- Priority-aware concurrency
- Dead letter queue support
- Circuit breaking + timeout handling
- In-memory, Postgres, Redis, or FS backends

---

## ⚙️ Install

```bash
bun add knock-mq
# or
npm install knock-mq
```

---

## 🧠 Core Concepts

Each job is a `QueueItem<T>`:

```ts
{
  id: string;
  priority: 'high' | 'normal' | 'low';
  data: T;
  metadata: {
    attempts: number;
    status: 'queued' | 'processing' | 'delivered' | 'failed' | 'undeliverable' | 'cancelled';
    queuedAt: Date;
    lastAttemptAt?: Date;
    nextAttemptAt?: Date;
    expiresAt?: Date;
    error?: string;
  };
}
```

---

## 🔧 Basic Usage

```ts
import { InMemoryStorage, QueueInstance } from 'knock-mq';

const storage = new InMemoryStorage();
const queue = new QueueInstance({
  name: 'email',
  maxRetries: 3,
  maxConcurrent: 5,
  timeoutMs: 10000,
  backoffBaseMs: 1000,
  logger: console,
  storage
});

queue.useProcessor(async (item) => {
  console.log('Processing', item.data);
  return { success: true };
});

await queue.enqueue({ email: 'a@example.com' });
await queue.start();
```

---

## 🔁 Retry + Backoff

- Failed jobs are retried with exponential backoff:
  - `base * 2^attempt` capped at 30s
- After `maxRetries`, item is marked `undeliverable`

---
## 📥 Enqueue / Dequeue

```ts
await queue.enqueue(data);               // Basic
await queue.enqueueOnce(id, data);       // Prevent duplicates
await queue.getDeadLetters();            // View failed jobs
```

---

## ⏸ Pause & Resume

```ts
await queue.pause();
await queue.resume();
```

Pausing uses the storage backend’s `isPaused()` control — safe for infra use.

---

## 📊 Stats

```ts
await queue.getStats();
```

Returns:
- Items per priority
- Processing count
- Error rate
- Average processing time

---

## 🚫 Expired Jobs

If a job has `expiresAt` set, it will be skipped if expired at dequeue time.

---

## 🧪 Testing & Local Development

You can use `InMemoryStorage()` for tests/dev or use a Postgres test DB.

---

## ✅ Summary

| Feature             | Included |
|---------------------|----------|
| Priority handling   | ✅        |
| Retry/backoff       | ✅        |
| Dead letter queue   | ✅        |
| Timeout protection  | ✅        |
| Pluggable storage   | ✅        |
| In-memory           | ✅        |
| Postgres/Redis/FS   | ✅ via examples |
| Circuit breaking    | ✅        |
| Job deduplication   | ✅        |
| Job expiration      | ✅        |
| Stats/monitoring    | ✅        |

---

## 🧩 Extend

Use your own storage engine by implementing:

```ts
interface ExtendedQueueStorage<T> {
  enqueue(item: QueueItem<T>): Promise<void>;
  dequeue(limit: number): Promise<QueueItem<T>[]>;
  updateStatus(...): Promise<void>;
  ...
}
```