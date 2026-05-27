import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

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
    .setTitle('SwiftyDrop Guard API')
    .setDescription(
      [
        'Backend API powering the SwiftyDrop Guard Telegram Mini App.',
        '',
        '**Modules:**',
        '- `auth` — Telegram WebApp initData verification',
        '- `users` — user profile & wallet attachment',
        '- `airdrops` — aggregated airdrop catalogue',
        '- `security` — airdrop & wallet risk analysis',
        '- `wallet` — health score, dangerous approvals, suspicious contracts',
        '- `tasks` — per-user airdrop checklist',
        '- `gamification` — XP, levels, streaks, badges, leaderboard',
        '- `referrals` — referral graph & reward grants',
        '- `crypto` — CoinGecko price & trending lookups',
        '- `notifications` — Telegram delivery with persist-then-send',
        '',
        '**Auth:** the only authenticated endpoint is `POST /auth/telegram` (validates Telegram WebApp `initData` HMAC). All other endpoints currently accept `userId`/`address` directly in the body or path; the frontend is expected to scope calls to the signed-in user.',
        '',
        '**Base URL:** all routes are prefixed with `/api`.',
      ].join('\n'),
    )
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
