import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Thin MySQL access layer built directly on mysql2 (no ORM) — kept
 * dependency-light and transparent on purpose (see docs/decisions.md).
 * Global so any feature module can inject DatabaseService.
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
