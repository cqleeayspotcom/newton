import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ClientLogsModule } from './client-logs/client-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        // Keep health polling out of the request log to reduce noise.
        autoLogging: { ignore: (req) => req.url === '/api/health' },
      },
    }),
    DatabaseModule,
    HealthModule,
    ClientLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
