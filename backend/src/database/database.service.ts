import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as mysql from 'mysql2/promise';

/**
 * Owns the MySQL connection pool. Exposes a minimal query surface plus a
 * ping() used by the health check. Configuration comes from env vars so the
 * same image runs locally and in Docker.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: mysql.Pool;

  onModuleInit(): void {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST ?? 'mysql',
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? 'newfoot',
      password: process.env.DB_PASSWORD ?? 'newfoot',
      database: process.env.DB_NAME ?? 'newfoot',
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
      enableKeepAlive: true,
    });
    this.logger.log(
      `MySQL pool created for ${process.env.DB_HOST ?? 'mysql'}:${
        process.env.DB_PORT ?? 3306
      }/${process.env.DB_NAME ?? 'newfoot'}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  /** Parameterized query helper. Always use placeholders — never string concat. */
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  /** Returns true if the DB answers a trivial query; never throws. */
  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (err) {
      this.logger.error(`DB ping failed: ${(err as Error).message}`);
      return false;
    }
  }
}
