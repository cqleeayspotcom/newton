import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging via pino (see §5.8 observability).
  app.useLogger(app.get(Logger));

  // All routes are served under /api so a single ngrok tunnel + frontend
  // reverse-proxy can serve the whole app (see CLAUDE.md).
  app.setGlobalPrefix('api');

  // POC is anonymous + browser-driven; permissive CORS is acceptable here.
  app.enableCors({ origin: true, credentials: true });

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`Newfoot backend listening on :${port}`, 'Bootstrap');
}
void bootstrap();
