import { Body, Controller, Logger, Post } from '@nestjs/common';

interface ClientLogEntry {
  level?: 'debug' | 'info' | 'warn' | 'error';
  message?: string;
  context?: unknown;
  sessionId?: string;
}

/**
 * POST /api/client-logs — lets the browser surface its own errors into the
 * backend structured logs during the POC (see §5.8 observability). Fire-and-forget.
 */
@Controller('client-logs')
export class ClientLogsController {
  private readonly logger = new Logger('ClientLog');

  @Post()
  ingest(@Body() entry: ClientLogEntry): { received: true } {
    const level = entry?.level ?? 'info';
    const msg = `[${entry?.sessionId ?? 'anon'}] ${entry?.message ?? ''}`;
    if (level === 'error') this.logger.error(msg, entry?.context);
    else if (level === 'warn') this.logger.warn(msg);
    else this.logger.log(msg);
    return { received: true };
  }
}
