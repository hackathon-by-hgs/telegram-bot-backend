import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';

import { UsersService } from '../users/users.service';
import { AirdropsService } from '../airdrops/airdrops.service';
import { SecurityService } from '../security/security.service';
import { WalletService } from '../wallet/wallet.service';
import { CryptoService } from '../crypto/crypto.service';
import { GamificationService } from '../gamification/gamification.service';
import { ReferralsService } from '../referrals/referrals.service';
import { TasksService } from '../tasks/tasks.service';

/**
 * Interactive Telegram bot for SwiftyDrop Guard.
 *
 * This is the *inbound* counterpart to the outbound `TelegramBotService` in
 * `src/telegram/` (which only pushes notifications). Here we run a Telegraf
 * long-polling client that turns the product's REST features — airdrop
 * discovery, scam scanning, wallet health, gamification — into chat commands.
 *
 * Design notes:
 * - Degrades gracefully: with no `TELEGRAM_BOT_TOKEN` it logs and stays dormant
 *   so the rest of the app (and tests) boot fine.
 * - `bot.launch()` only resolves when the bot *stops*, so we never await it in
 *   `onModuleInit` — doing so would block Nest's bootstrap forever.
 * - Every Telegram user is mapped to a `User` row via `usersService` on first
 *   contact, mirroring the Mini App's `POST /auth/telegram` upsert.
 */
@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(TelegramBotService.name);
  private bot?: Telegraf;
  private botUsername?: string;

  /** Command list advertised to Telegram clients (the "/" menu) and `/help`. */
  static readonly COMMANDS: ReadonlyArray<{ command: string; description: string }> = [
    { command: 'start', description: 'Register & get your referral link' },
    { command: 'airdrops', description: 'Browse the latest airdrops' },
    { command: 'airdrop', description: 'Airdrop details + security report — /airdrop <id>' },
    { command: 'scan', description: 'Scan a domain or contract for scams — /scan <domain|0x...>' },
    { command: 'wallet', description: 'Analyze wallet health — /wallet <0x address>' },
    { command: 'price', description: 'Token price — /price <coin id>' },
    { command: 'trending', description: 'Trending coins right now' },
    { command: 'tasks', description: 'Your airdrop task checklist' },
    { command: 'profile', description: 'Your XP, level, streak & badges' },
    { command: 'leaderboard', description: 'Top hunters by XP' },
    { command: 'referrals', description: 'Your referrals & invite link' },
    { command: 'help', description: 'Show all commands' },
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly airdrops: AirdropsService,
    private readonly security: SecurityService,
    private readonly wallet: WalletService,
    private readonly crypto: CryptoService,
    private readonly gamification: GamificationService,
    private readonly referrals: ReferralsService,
    private readonly tasks: TasksService,
  ) {}

  /** True once a token is configured and Telegraf has launched. */
  get running(): boolean {
    return !!this.bot;
  }

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.log.warn('TELEGRAM_BOT_TOKEN not set — interactive bot disabled.');
      return;
    }

    const bot = new Telegraf(token);
    this.registerHandlers(bot);
    bot.catch((err, ctx) => {
      this.log.error(`Unhandled error for ${ctx.updateType}: ${(err as Error).message}`);
    });

    // Fire-and-forget: launch() resolves only when the bot stops.
    bot
      .launch(() => {
        this.bot = bot;
        this.botUsername = bot.botInfo?.username;
        this.log.log(`Interactive bot @${this.botUsername ?? '?'} launched (long polling).`);
        bot.telegram
          .setMyCommands([...TelegramBotService.COMMANDS])
          .catch((e) => this.log.warn(`setMyCommands failed: ${e.message}`));
      })
      .catch((err) => this.log.error(`Bot launch failed: ${(err as Error).message}`));

    // Telegraf recommends stopping on process signals for clean polling shutdown.
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }

  onModuleDestroy() {
    this.bot?.stop('moduleDestroy');
  }

  // ── Handler registration ────────────────────────────────────────────────

  private registerHandlers(bot: Telegraf) {
    bot.start((ctx) => this.guard(ctx, () => this.onStart(ctx)));
    bot.help((ctx) => ctx.reply(this.helpText()));
    bot.command('airdrops', (ctx) => this.guard(ctx, () => this.onAirdrops(ctx)));
    bot.command('airdrop', (ctx) => this.guard(ctx, () => this.onAirdrop(ctx)));
    bot.command('scan', (ctx) => this.guard(ctx, () => this.onScan(ctx)));
    bot.command('wallet', (ctx) => this.guard(ctx, () => this.onWallet(ctx)));
    bot.command('price', (ctx) => this.guard(ctx, () => this.onPrice(ctx)));
    bot.command('trending', (ctx) => this.guard(ctx, () => this.onTrending(ctx)));
    bot.command('tasks', (ctx) => this.guard(ctx, () => this.onTasks(ctx)));
    bot.command('profile', (ctx) => this.guard(ctx, () => this.onProfile(ctx)));
    bot.command('me', (ctx) => this.guard(ctx, () => this.onProfile(ctx)));
    bot.command('leaderboard', (ctx) => this.guard(ctx, () => this.onLeaderboard(ctx)));
    bot.command('referrals', (ctx) => this.guard(ctx, () => this.onReferrals(ctx)));
    bot.on(message('text'), (ctx) =>
      ctx.reply('Unknown command. Send /help to see what I can do.'),
    );
  }

  /** Wraps a handler so any thrown error becomes a friendly reply, not a crash. */
  private async guard(ctx: Context, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.log.warn(`handler failed: ${(err as Error).message}`);
      await ctx.reply('⚠️ Something went wrong handling that. Please try again.');
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  private async onStart(ctx: Context) {
    const user = await this.resolveUser(ctx);
    const link = this.referralLink(user.referralCode);
    await ctx.reply(
      [
        '🛡️ *Welcome to SwiftyDrop Guard!*',
        '',
        'Discover legit airdrops and stay safe from scams.',
        '',
        `Your referral code: \`${user.referralCode}\``,
        link ? `Invite friends: ${link}` : '',
        '',
        this.helpText(),
      ]
        .filter(Boolean)
        .join('\n'),
      { parse_mode: 'Markdown' },
    );
  }

  private async onAirdrops(ctx: Context) {
    const list = await this.airdrops.list({ take: 10 });
    if (!list.length) {
      await ctx.reply('No airdrops indexed yet — check back soon. 🔄');
      return;
    }
    const lines = list.map((a) => {
      const trust = a.trustScore != null ? ` · trust ${a.trustScore}/100` : '';
      const reward = a.rewardEstimate ? ` · ${a.rewardEstimate}` : '';
      return `• *${this.md(a.name)}*${reward}${trust}\n  /airdrop ${a.id}`;
    });
    await ctx.reply(`🪂 *Latest airdrops*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  }

  private async onAirdrop(ctx: Context) {
    const id = this.arg(ctx);
    if (!id) {
      await ctx.reply('Usage: /airdrop <id>  (get an id from /airdrops)');
      return;
    }
    const a = await this.airdrops.get(id).catch(() => null);
    if (!a) {
      await ctx.reply('Airdrop not found. Use /airdrops to see valid ids.');
      return;
    }
    const report = a.securityReports?.[0];
    const out = [
      `🪂 *${this.md(a.name)}*`,
      a.description ? this.md(a.description) : '',
      '',
      a.rewardEstimate ? `💰 Reward: ${this.md(a.rewardEstimate)}` : '',
      a.category ? `🏷️ Category: ${this.md(a.category)}` : '',
      a.difficulty ? `🎯 Difficulty: ${this.md(a.difficulty)}` : '',
      a.deadline ? `⏳ Deadline: ${new Date(a.deadline).toUTCString()}` : '',
      a.trustScore != null ? `🛡️ Trust score: ${a.trustScore}/100` : '',
      report
        ? `\n🔎 *Latest scan:* ${report.riskLevel.toUpperCase()} risk (${report.scamProbability}% scam prob.)`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    await ctx.reply(out, { parse_mode: 'Markdown' });
  }

  private async onScan(ctx: Context) {
    const subject = this.arg(ctx);
    if (!subject) {
      await ctx.reply('Usage: /scan <domain or 0x contract>\nExample: /scan free-airdrop.xyz');
      return;
    }
    const isContract = /^0x[a-fA-F0-9]{40}$/.test(subject);
    const report = await this.security.analyzeAirdrop(
      isContract ? { contractAddress: subject, chain: 'eth' } : { domain: subject },
    );
    const emoji = this.riskEmoji(report.risk_level);
    const warnings = report.warnings.length
      ? '\n\n⚠️ ' + report.warnings.map((w) => this.md(w)).join('\n⚠️ ')
      : '';
    await ctx.reply(
      [
        `${emoji} *Security scan: ${this.md(subject)}*`,
        '',
        `Risk level: *${report.risk_level.toUpperCase()}*`,
        `Trust score: ${report.trust_score}/100`,
        `Scam probability: ${report.scam_probability}%`,
        '',
        `📋 ${this.md(report.recommendation)}`,
        warnings,
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  }

  private async onWallet(ctx: Context) {
    const address = this.arg(ctx);
    if (!address) {
      await ctx.reply('Usage: /wallet <0x address>');
      return;
    }
    const analysis = await this.wallet.analyze(address).catch((e: Error) => {
      throw new Error(e.message);
    });
    // Remember the address against the user for the Mini App / notifications.
    const user = await this.resolveUser(ctx);
    await this.users.attachWallet(user.id, address).catch(() => undefined);

    const score = analysis.wallet_health_score;
    const health = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
    const indicators = analysis.risk_indicators.length
      ? '\n\n⚠️ ' + analysis.risk_indicators.map((r) => this.md(r)).join('\n⚠️ ')
      : '\n\n✅ No risk indicators found.';
    const recs = analysis.recommendations.map((r) => `• ${this.md(r)}`).join('\n');
    await ctx.reply(
      [
        `${health} *Wallet health: ${score}/100*`,
        `\`${this.md(address)}\``,
        indicators,
        '',
        `📋 *Recommendations*\n${recs}`,
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  }

  private async onPrice(ctx: Context) {
    const coin = this.arg(ctx).toLowerCase();
    if (!coin) {
      await ctx.reply('Usage: /price <coin id>\nExample: /price ethereum');
      return;
    }
    const price = await this.crypto.price(coin);
    if (price == null) {
      await ctx.reply(`Couldn't find a price for "${coin}". Try a CoinGecko id like \`ethereum\`.`, {
        parse_mode: 'Markdown',
      });
      return;
    }
    await ctx.reply(`💵 *${this.md(coin)}* = $${price.toLocaleString('en-US')}`, {
      parse_mode: 'Markdown',
    });
  }

  private async onTrending(ctx: Context) {
    const coins = await this.crypto.trending();
    if (!coins.length) {
      await ctx.reply('No trending data available right now.');
      return;
    }
    const lines = coins
      .slice(0, 10)
      .map((c, i) => `${i + 1}. ${this.md(c.name)} (${this.md(c.symbol.toUpperCase())})`);
    await ctx.reply(`🔥 *Trending coins*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  }

  private async onTasks(ctx: Context) {
    const user = await this.resolveUser(ctx);
    const tasks = await this.tasks.forUser(user.id);
    if (!tasks.length) {
      await ctx.reply('You have no tasks yet. Open an airdrop in the app to start a checklist.');
      return;
    }
    const lines = tasks.map((t) => {
      const mark = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜';
      const airdrop = t.airdrop?.name ? ` (${this.md(t.airdrop.name)})` : '';
      return `${mark} ${this.md(t.label)}${airdrop}`;
    });
    await ctx.reply(`📝 *Your tasks*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  }

  private async onProfile(ctx: Context) {
    const user = await this.resolveUser(ctx);
    const stats = await this.gamification.stats(user.id);
    const xp = stats?.xp ?? 0;
    const level = stats?.level ?? 1;
    const streak = stats?.streak ?? 0;
    const badges = stats?.badges?.length
      ? stats.badges.map((b) => `🏅 ${this.md(b.replace(/_/g, ' '))}`).join('\n')
      : 'None yet — complete tasks to earn some!';
    await ctx.reply(
      [
        `👤 *${this.md(user.username ?? 'Hunter')}*`,
        '',
        `⭐ Level ${level}  ·  ${xp} XP`,
        `🔥 Streak: ${streak} day(s)`,
        '',
        `*Badges*\n${badges}`,
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  }

  private async onLeaderboard(ctx: Context) {
    const top = await this.gamification.leaderboard(10);
    if (!top.length) {
      await ctx.reply('Leaderboard is empty — be the first to earn XP! 🏆');
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((row, i) => {
      const name = row.user?.username ?? row.user?.referralCode ?? 'anon';
      return `${medals[i] ?? `${i + 1}.`} ${this.md(name)} — ${row.xp} XP (lvl ${row.level})`;
    });
    await ctx.reply(`🏆 *Leaderboard*\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' });
  }

  private async onReferrals(ctx: Context) {
    const user = await this.resolveUser(ctx);
    const { count } = await this.referrals.forUser(user.id);
    const link = this.referralLink(user.referralCode);
    await ctx.reply(
      [
        `🤝 *Your referrals: ${count}*`,
        '',
        `Code: \`${user.referralCode}\``,
        link ? `Share: ${link}` : 'Set TELEGRAM_BOT_USERNAME to generate share links.',
        '',
        'Each friend who joins earns you 100 XP.',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Get-or-create the User row for the sender (idempotent; applies referral on first contact). */
  private resolveUser(ctx: Context) {
    const from = ctx.from!;
    const payload =
      'startPayload' in ctx && typeof (ctx as any).startPayload === 'string'
        ? (ctx as any).startPayload
        : undefined;
    return this.users.upsertFromTelegram({
      telegramId: String(from.id),
      username: from.username,
      referralCode: payload || undefined,
    });
  }

  /** Text following the command word, e.g. "/scan foo.com" -> "foo.com". */
  private arg(ctx: Context): string {
    const text = (ctx.message && 'text' in ctx.message ? ctx.message.text : '') ?? '';
    const space = text.indexOf(' ');
    return space === -1 ? '' : text.slice(space + 1).trim();
  }

  private referralLink(code: string): string | '' {
    const username =
      this.botUsername ?? this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? '';
    return username ? `https://t.me/${username}?start=${code}` : '';
  }

  private riskEmoji(level: string): string {
    return level === 'high' ? '🔴' : level === 'medium' ? '🟡' : '🟢';
  }

  /** Escape the Markdown control chars that break Telegram's legacy Markdown parser. */
  private md(s: string): string {
    return String(s).replace(/([_*`\[])/g, '\\$1');
  }

  private helpText(): string {
    return (
      'Commands:\n' +
      TelegramBotService.COMMANDS.map((c) => `/${c.command} — ${c.description}`).join('\n')
    );
  }
}
