//
// === POSTGRES (Real Guide) ===
//

import { Pool } from 'pg';
import { QueueItem, QueuePriority, QueueStatus } from './src/queue';
import type { ExtendedQueueStorage } from './src/storage';

export class PostgresStorage<T = unknown> implements ExtendedQueueStorage<T> {
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      port: parseInt(process.env.PGPORT || '5432', 10),
    });
  }

  async enqueue(item: QueueItem<T>) {
    await this.pool.query(`
      INSERT INTO queue_items (
        id, priority, data, metadata
      ) VALUES ($1, $2, $3, $4::jsonb)
    `, [item.id, item.priority, item.data, JSON.stringify(item.metadata)]);
  }

  async enqueueOnce(id: string, data: T, opts: Partial<QueueItem<T>> = {}): Promise<boolean> {
    const { rows } = await this.pool.query(
      `SELECT 1 FROM queue_items WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (rows.length > 0) return false;

    const item: QueueItem<T> = {
      id,
      priority: opts.priority || 'normal',
      data,
      metadata: {
        status: 'queued',
        attempts: 0,
        queuedAt: new Date(),
        ...opts.metadata
      }
    };

    await this.enqueue(item);
    return true;
  }

  async updateStatus(id: string, status: QueueStatus): Promise<void> {
    await this.pool.query(`
      UPDATE queue_items
      SET metadata = jsonb_set(metadata, '{status}', to_jsonb($2::text))
      WHERE id = $1
    `, [id, status]);
  }

  async complete(id: string): Promise<void> {
    await this.updateStatus(id, 'delivered');
  }

  async moveToDeadLetter(id: string, reason: string): Promise<void> {
    await this.pool.query(`
      UPDATE queue_items
      SET metadata = jsonb_set(
        jsonb_set(metadata, '{status}', to_jsonb('undeliverable')),
        '{error}', to_jsonb($2::text)
      )
      WHERE id = $1
    `, [id, reason]);
  }

  async getProcessingCounts(): Promise<Record<QueuePriority, number>> {
    const { rows } = await this.pool.query(`
      SELECT priority, COUNT(*) as count
      FROM queue_items
      WHERE metadata->>'status' = 'processing'
      GROUP BY priority
    `);

    const result: Record<QueuePriority, number> = { high: 0, normal: 0, low: 0 };
    for (const row of rows) {
      result[row.priority as QueuePriority] = parseInt(row.count, 10);
    }
    return result;
  }

  async findStuckProcessing(since: Date): Promise<QueueItem<T>[]> {
    const { rows } = await this.pool.query(`
      SELECT * FROM queue_items
      WHERE metadata->>'status' = 'processing'
        AND (metadata->>'lastAttemptAt')::timestamptz < $1
    `, [since.toISOString()]);

    return rows.map(row => this.deserialize(row));
  }

  async dequeue(limit: number): Promise<QueueItem<T>[]> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(`
      SELECT * FROM queue_items
      WHERE metadata->>'status' = 'queued'
        AND (
          metadata->>'nextAttemptAt' IS NULL
          OR (metadata->>'nextAttemptAt')::timestamptz <= $1
        )
        AND (
          metadata->>'expiresAt' IS NULL
          OR (metadata->>'expiresAt')::timestamptz > $1
        )
      ORDER BY
        CASE priority
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          ELSE 3
        END,
        (metadata->>'queuedAt')::timestamptz ASC
      LIMIT $2
    `, [now, limit]);

    return rows.map(row => this.deserialize(row));
  }

  async getDeadLetterItems(limit: number): Promise<QueueItem<T>[]> {
    const { rows } = await this.pool.query(`
      SELECT * FROM queue_items
      WHERE metadata->>'status' = 'undeliverable'
      ORDER BY (metadata->>'queuedAt')::timestamptz DESC
      LIMIT $1
    `, [limit]);

    return rows.map(row => this.deserialize(row));
  }

  async isPaused(): Promise<boolean> {
    const { rows } = await this.pool.query(`SELECT value FROM queue_meta WHERE key = 'paused' LIMIT 1`);
    return rows.length > 0 && rows[0].value === 'true';
  }

  async pause(): Promise<void> {
    await this.pool.query(`INSERT INTO queue_meta (key, value)
      VALUES ('paused', 'true')
      ON CONFLICT (key) DO UPDATE SET value = 'true'`);
  }

  async resume(): Promise<void> {
    await this.pool.query(`INSERT INTO queue_meta (key, value)
      VALUES ('paused', 'false')
      ON CONFLICT (key) DO UPDATE SET value = 'false'`);
  }

  private deserialize(row: any): QueueItem<T> {
    return {
      id: row.id,
      priority: row.priority,
      data: row.data,
      metadata: row.metadata
    };
  }
}
