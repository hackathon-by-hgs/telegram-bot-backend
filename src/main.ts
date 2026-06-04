import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

// Prefer IPv4 for all outbound DNS. Node defaults to "verbatim" ordering, which
// tries AAAA (IPv6) first — fatal on hosts with broken IPv6 egress (e.g. WSL2),
// where api.telegram.org / coingecko / etherscan calls fail with opaque socket
// errors. This is a no-op on healthy dual-stack and IPv6-only hosts.
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.ALLOW_CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3000);

  const swaggerConfig = new DocumentBuilder()
    .setVersion('0.0.1')
    .addServer(`http://localhost:${port}`, 'Local dev')
    .addTag('auth', 'Telegram Mini App authentication')
    .addTag('users', 'User profile & wallet')
    .addTag('airdrops', 'Airdrop catalogue')
    .addTag('security', 'Risk analysis for airdrops & wallets')
    .addTag('wallet', 'Wallet health & approval analysis')
    .addTag('tasks', 'Per-user airdrop task lists')
    .addTag('gamification', 'XP, levels, streaks, badges')
    .addTag('referrals', 'Referral graph')
    .addTag('crypto', 'CoinGecko price feeds')
    .addTag('notifications', 'Telegram notifications')
    .addTag('health', 'Liveness probes')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`SwiftyDrop Guard backend listening on :${port} (prefix /api)`);
  logger.log(`Swagger UI:  http://localhost:${port}/api/docs`);
  logger.log(`OpenAPI JSON: http://localhost:${port}/api/docs-json`);
}
bootstrap();
