import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * GET /api/health — liveness + DB readiness. Used by:
 *  - docker-compose healthcheck
 *  - init.sh startup wait loop
 *  - the frontend shell (proves the /api reverse-proxy + DB wiring end-to-end)
 */
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check() {
    const dbOk = await this.db.ping();
    return {
      status: 'ok',
      db: dbOk ? 'ok' : 'down',
      uptimeSec: Math.round(process.uptime()),
    };
  }
}
