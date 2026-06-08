import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Agent } from 'node:https';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import type { InlineKeyboardButton } from 'telegraf/types';

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
  static readonly COMMANDS: ReadonlyArray<{
    command: string;
    description: string;
  }> = [
    { command: 'start', description: 'Register & get your referral link' },
    { command: 'airdrops', description: 'Browse the latest airdrops' },
    {
      command: 'airdrop',
      description: 'Airdrop details + security report — /airdrop <id>',
    },
    {
      command: 'scan',
      description: 'Scan a domain or contract for scams — /scan <domain|0x...>',
    },
    {
      command: 'wallet',
      description: 'Analyze wallet health — /wallet <0x address>',
    },
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

    // Telegraf's default keepAlive agent does not enable Happy Eyeballs, so on
    // hosts with broken IPv6 egress (e.g. WSL2) it pins the first (IPv6) address
    // and every API call times out with an opaque error. Supplying an agent with
    // `autoSelectFamily` races IPv4/IPv6 and keeps whichever connects.
    const agent = new Agent({
      keepAlive: true,
      keepAliveMsecs: 10_000,
      autoSelectFamily: true,
    });

    const bot = new Telegraf(token, { telegram: { agent } });
    this.registerHandlers(bot);
    bot.catch((err, ctx) => {
      this.log.error(
        `Unhandled error for ${ctx.updateType}: ${(err as Error).message}`,
      );
    });

    // Fire-and-forget: launch() resolves only when the bot stops.
    bot
      .launch(() => {
        this.bot = bot;
        this.botUsername = bot.botInfo?.username;
        this.log.log(
          `Interactive bot @${this.botUsername ?? '?'} launched (long polling).`,
        );
        bot.telegram
          .setMyCommands([...TelegramBotService.COMMANDS])
          .catch((e) => this.log.warn(`setMyCommands failed: ${e.message}`));

        // Wire the persistent chat menu button (bottom-left of the input box) to
        // the Mini App when a URL is configured. Setting it with no chat_id makes
        // it the default for every private chat. Falls back to the command list
        // when WEBAPP_URL is blank so we never push an invalid empty-url button.
        const webAppUrl = this.webAppUrl();
        bot.telegram
          .setChatMenuButton({
            menuButton: webAppUrl
              ? { type: 'web_app', text: 'Open App', web_app: { url: webAppUrl } }
              : { type: 'commands' },
          })
          .catch((e) =>
            this.log.warn(`setChatMenuButton failed: ${e.message}`),
          );
      })
      .catch((err) =>
        this.log.error(`Bot launch failed: ${(err as Error).message}`),
      );

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
    bot.help((ctx) => this.guard(ctx, () => this.onHelp(ctx)));
    bot.command('airdrops', (ctx) =>
      this.guard(ctx, () => this.onAirdrops(ctx)),
    );
    bot.command('airdrop', (ctx) => this.guard(ctx, () => this.onAirdrop(ctx)));
    bot.command('scan', (ctx) => this.guard(ctx, () => this.onScan(ctx)));
    bot.command('wallet', (ctx) => this.guard(ctx, () => this.onWallet(ctx)));
    bot.command('price', (ctx) => this.guard(ctx, () => this.onPrice(ctx)));
    bot.command('trending', (ctx) =>
      this.guard(ctx, () => this.onTrending(ctx)),
    );
    bot.command('tasks', (ctx) => this.guard(ctx, () => this.onTasks(ctx)));
    bot.command('profile', (ctx) => this.guard(ctx, () => this.onProfile(ctx)));
    bot.command('me', (ctx) => this.guard(ctx, () => this.onProfile(ctx)));
    bot.command('leaderboard', (ctx) =>
      this.guard(ctx, () => this.onLeaderboard(ctx)),
    );
    bot.command('referrals', (ctx) =>
      this.guard(ctx, () => this.onReferrals(ctx)),
    );

    // Inline-button callbacks. Buttons carry a compact `verb:arg` token in their
    // callback_data; we route on the verb and reuse the same render helpers the
    // slash-commands use, so a tap and a typed command produce identical output.
    // `guardCb` also acks the tap so Telegram clears the button's spinner.
    bot.action('nav:menu', (ctx) =>
      this.guardCb(ctx, () => this.onStart(ctx, true)),
    );
    bot.action('nav:airdrops', (ctx) =>
      this.guardCb(ctx, () => this.onAirdrops(ctx, true)),
    );
    bot.action('nav:profile', (ctx) =>
      this.guardCb(ctx, () => this.onProfile(ctx, true)),
    );
    bot.action('nav:leaderboard', (ctx) =>
      this.guardCb(ctx, () => this.onLeaderboard(ctx, true)),
    );
    bot.action('nav:tasks', (ctx) =>
      this.guardCb(ctx, () => this.onTasks(ctx, true)),
    );
    bot.action('nav:trending', (ctx) =>
      this.guardCb(ctx, () => this.onTrending(ctx, true)),
    );
    bot.action('nav:scan', (ctx) =>
      this.guardCb(ctx, () => this.onScanPrompt(ctx)),
    );
    bot.action(/^airdrop:(.+)$/, (ctx) =>
      this.guardCb(ctx, () => this.onAirdrop(ctx, true, ctx.match[1])),
    );
    bot.action(/^scan:(.+)$/, (ctx) =>
      this.guardCb(ctx, () => this.onScan(ctx, true, ctx.match[1])),
    );

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
      await ctx.reply(
        '⚠️ Something went wrong handling that. Please try again.',
      );
    }
  }

  /**
   * Like `guard`, but for inline-button callbacks. We always `answerCbQuery()`
   * in a `finally` so the tapped button stops showing its loading spinner —
   * Telegram nags (and eventually errors) if a callback goes unanswered.
   */
  private async guardCb(ctx: Context, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.log.warn(`callback failed: ${(err as Error).message}`);
    } finally {
      await ctx.answerCbQuery().catch(() => undefined);
    }
  }

  /**
   * Render a screen. From a slash-command we send a fresh message; from a
   * button tap we edit the message the button is attached to, giving a
   * single-message "drill in / back" navigation. Editing can fail (message too
   * old, or identical content) so we fall back to a plain reply.
   */
  private async present(
    ctx: Context,
    text: string,
    keyboard: ReturnType<typeof Markup.inlineKeyboard> | undefined,
    edit: boolean,
  ) {
    const extra = { parse_mode: 'Markdown' as const, ...(keyboard ?? {}) };
    if (edit) {
      try {
        await ctx.editMessageText(text, extra);
        return;
      } catch {
        // fall through to reply
      }
    }
    await ctx.reply(text, extra);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  private async onStart(ctx: Context, edit = false) {
    const user = await this.resolveUser(ctx);
    const link = this.referralLink(user.referralCode);
    const text = [
      '🛡️ *Welcome to SwiftyDrop Guard!*',
      '',
      'Discover legit airdrops and stay safe from scams.',
      '',
      `🎟️ Your referral code: \`${user.referralCode}\``,
      '',
      'Tap a button below, or send /help for the full command list.',
    ].join('\n');
    await this.present(ctx, text, this.mainMenu(link), edit);
  }

  private async onHelp(ctx: Context) {
    await this.present(ctx, this.helpText(), this.mainMenu(), false);
  }

  private async onAirdrops(ctx: Context, edit = false) {
    const list = await this.airdrops.list({ take: 8 });
    if (!list.length) {
      await this.present(
        ctx,
        'No airdrops indexed yet — check back soon. 🔄',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Refresh', 'nav:airdrops')],
        ]),
        edit,
      );
      return;
    }
    // One button per airdrop; the score badge gives an at-a-glance trust read.
    const rows = list.map((a) => {
      const badge =
        a.trustScore != null
          ? `${this.trustEmoji(a.trustScore)} ${a.trustScore}`
          : '•';
      return [
        Markup.button.callback(
          `🪂 ${this.truncate(a.name, 26)}  ·  ${badge}`,
          `airdrop:${a.id}`,
        ),
      ];
    });
    rows.push([
      Markup.button.callback('🔄 Refresh', 'nav:airdrops'),
      Markup.button.callback('« Menu', 'nav:menu'),
    ]);
    await this.present(
      ctx,
      '🪂 *Latest airdrops*\n\nTap one to see its details and trust score:',
      Markup.inlineKeyboard(rows),
      edit,
    );
  }

  private async onAirdrop(ctx: Context, edit = false, idArg?: string) {
    const id = idArg ?? this.arg(ctx);
    if (!id) {
      await ctx.reply('Usage: /airdrop <id>  (get an id from /airdrops)');
      return;
    }
    const a = await this.airdrops.get(id).catch(() => null);
    if (!a) {
      await this.present(
        ctx,
        'Airdrop not found. Use /airdrops to see valid ids.',
        Markup.inlineKeyboard([
          [Markup.button.callback('« Back to airdrops', 'nav:airdrops')],
        ]),
        edit,
      );
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
      a.trustScore != null
        ? `${this.trustEmoji(a.trustScore)} Trust score: ${a.trustScore}/100`
        : '',
      report
        ? `\n🔎 *Latest scan:* ${report.riskLevel.toUpperCase()} risk (${report.scamProbability}% scam prob.)`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Build context-aware action buttons from whatever data we have.
    const site = this.firstLink(a.socialLinks);
    const host = site ? this.hostOf(site) : undefined;
    const rows: InlineKeyboardButton[][] = [];
    if (site) rows.push([Markup.button.webApp('🌐 Official site', site)]);
    if (host)
      rows.push([
        Markup.button.callback('🛡️ Scan it for scams', `scan:${host}`),
      ]);
    rows.push([Markup.button.callback('« Back to airdrops', 'nav:airdrops')]);
    await this.present(ctx, out, Markup.inlineKeyboard(rows), edit);
  }

  private async onScanPrompt(ctx: Context) {
    await this.present(
      ctx,
      '🛡️ *Scam scanner*\n\nSend `/scan <domain or 0x contract>` and I’ll check it.\nExample: `/scan free-airdrop.xyz`',
      Markup.inlineKeyboard([[Markup.button.callback('« Menu', 'nav:menu')]]),
      true,
    );
  }

  private async onScan(ctx: Context, edit = false, subjectArg?: string) {
    const subject = subjectArg ?? this.arg(ctx);
    if (!subject) {
      await ctx.reply(
        'Usage: /scan <domain or 0x contract>\nExample: /scan free-airdrop.xyz',
      );
      return;
    }
    const isContract = /^0x[a-fA-F0-9]{40}$/.test(subject);
    const report = await this.security.analyzeAirdrop(
      isContract
        ? { contractAddress: subject, chain: 'eth' }
        : { domain: subject },
    );
    const emoji = this.riskEmoji(report.risk_level);
    const warnings = report.warnings.length
      ? '\n\n⚠️ ' + report.warnings.map((w) => this.md(w)).join('\n⚠️ ')
      : '';
    await this.present(
      ctx,
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
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🪂 Airdrops', 'nav:airdrops'),
          Markup.button.callback('« Menu', 'nav:menu'),
        ],
      ]),
      edit,
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
      ? '\n\n⚠️ ' +
        analysis.risk_indicators.map((r) => this.md(r)).join('\n⚠️ ')
      : '\n\n✅ No risk indicators found.';
    const recs = analysis.recommendations
      .map((r) => `• ${this.md(r)}`)
      .join('\n');
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
      await ctx.reply(
        `Couldn't find a price for "${coin}". Try a CoinGecko id like \`ethereum\`.`,
        {
          parse_mode: 'Markdown',
        },
      );
      return;
    }
    await ctx.reply(
      `💵 *${this.md(coin)}* = $${price.toLocaleString('en-US')}`,
      {
        parse_mode: 'Markdown',
      },
    );
  }

  private async onTrending(ctx: Context, edit = false) {
    const coins = await this.crypto.trending();
    if (!coins.length) {
      await this.present(
        ctx,
        'No trending data available right now.',
        this.footer(),
        edit,
      );
      return;
    }
    const lines = coins
      .slice(0, 10)
      .map(
        (c, i) =>
          `${i + 1}. ${this.md(c.name)} (${this.md(c.symbol.toUpperCase())})`,
      );
    await this.present(
      ctx,
      `🔥 *Trending coins*\n\n${lines.join('\n')}`,
      this.footer(),
      edit,
    );
  }

  private async onTasks(ctx: Context, edit = false) {
    const user = await this.resolveUser(ctx);
    const tasks = await this.tasks.forUser(user.id);
    if (!tasks.length) {
      await this.present(
        ctx,
        'You have no tasks yet. Open an airdrop to start a checklist.',
        this.footer([Markup.button.callback('🪂 Airdrops', 'nav:airdrops')]),
        edit,
      );
      return;
    }
    const lines = tasks.map((t) => {
      const mark =
        t.status === 'completed'
          ? '✅'
          : t.status === 'in_progress'
            ? '🔄'
            : '⬜';
      const airdrop = t.airdrop?.name ? ` (${this.md(t.airdrop.name)})` : '';
      return `${mark} ${this.md(t.label)}${airdrop}`;
    });
    await this.present(
      ctx,
      `📝 *Your tasks*\n\n${lines.join('\n')}`,
      this.footer(),
      edit,
    );
  }

  private async onProfile(ctx: Context, edit = false) {
    const user = await this.resolveUser(ctx);
    const stats = await this.gamification.stats(user.id);
    const xp = stats?.xp ?? 0;
    const level = stats?.level ?? 1;
    const streak = stats?.streak ?? 0;
    const badges = stats?.badges?.length
      ? stats.badges
          .map((b) => `🏅 ${this.md(b.replace(/_/g, ' '))}`)
          .join('\n')
      : 'None yet — complete tasks to earn some!';
    await this.present(
      ctx,
      [
        `👤 *${this.md(user.username ?? 'Hunter')}*`,
        '',
        `⭐ Level ${level}  ·  ${xp} XP`,
        `🔥 Streak: ${streak} day(s)`,
        '',
        `*Badges*\n${badges}`,
      ].join('\n'),
      this.footer([
        Markup.button.callback('📝 Tasks', 'nav:tasks'),
        Markup.button.callback('🏆 Leaderboard', 'nav:leaderboard'),
      ]),
      edit,
    );
  }

  private async onLeaderboard(ctx: Context, edit = false) {
    const top = await this.gamification.leaderboard(10);
    if (!top.length) {
      await this.present(
        ctx,
        'Leaderboard is empty — be the first to earn XP! 🏆',
        this.footer(),
        edit,
      );
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const lines = top.map((row, i) => {
      const name = row.user?.username ?? row.user?.referralCode ?? 'anon';
      return `${medals[i] ?? `${i + 1}.`} ${this.md(name)} — ${row.xp} XP (lvl ${row.level})`;
    });
    await this.present(
      ctx,
      `🏆 *Leaderboard*\n\n${lines.join('\n')}`,
      this.footer([Markup.button.callback('👤 My profile', 'nav:profile')]),
      edit,
    );
  }

  private async onReferrals(ctx: Context, edit = false) {
    const user = await this.resolveUser(ctx);
    const { count } = await this.referrals.forUser(user.id);
    const link = this.referralLink(user.referralCode);
    const rows: InlineKeyboardButton[][] = [];
    if (link)
      rows.push([Markup.button.webApp('🔗 Share my invite', this.shareUrl(link))]);
    rows.push([Markup.button.callback('« Menu', 'nav:menu')]);
    await this.present(
      ctx,
      [
        `🤝 *Your referrals: ${count}*`,
        '',
        `Code: \`${user.referralCode}\``,
        link
          ? `Link: ${link}`
          : 'Set TELEGRAM_BOT_USERNAME to generate share links.',
        '',
        'Each friend who joins earns you 100 XP.',
      ].join('\n'),
      Markup.inlineKeyboard(rows),
      edit,
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
    const text =
      (ctx.message && 'text' in ctx.message ? ctx.message.text : '') ?? '';
    const space = text.indexOf(' ');
    return space === -1 ? '' : text.slice(space + 1).trim();
  }

  private referralLink(code: string): string | '' {
    const username =
      this.botUsername ??
      this.config.get<string>('TELEGRAM_BOT_USERNAME') ??
      '';
    return username ? `https://t.me/${username}?start=${code}` : '';
  }

  private riskEmoji(level: string): string {
    return level === 'high' ? '🔴' : level === 'medium' ? '🟡' : '🟢';
  }

  /** Traffic-light badge for a 0–100 trust score. */
  private trustEmoji(score: number): string {
    return score >= 70 ? '🟢' : score >= 40 ? '🟡' : '🔴';
  }

  // ── Inline-keyboard builders ───────────────────────────────────────────────

  /** Home screen keyboard. Adds a share button only when a referral link exists. */
  private mainMenu(link?: string) {
    const rows: InlineKeyboardButton[][] = [
      [
        Markup.button.callback('🪂 Airdrops', 'nav:airdrops'),
        Markup.button.callback('🛡️ Scan', 'nav:scan'),
      ],
      [
        Markup.button.callback('👤 Profile', 'nav:profile'),
        Markup.button.callback('🏆 Leaderboard', 'nav:leaderboard'),
      ],
      [
        Markup.button.callback('📝 Tasks', 'nav:tasks'),
        Markup.button.callback('🔥 Trending', 'nav:trending'),
      ],
    ];
    // Launch the Mini App in-Telegram. webApp buttons inject the signed
    // `initData` our /auth/telegram endpoint verifies; only shown when configured.
    const webAppUrl = this.webAppUrl();
    if (webAppUrl)
      rows.push([Markup.button.webApp('🚀 Open App', webAppUrl)]);
    if (link)
      rows.push([Markup.button.webApp('🤝 Invite friends', this.shareUrl(link))]);
    return Markup.inlineKeyboard(rows);
  }

  /** Configured HTTPS URL of the Mini App, or undefined when unset/blank. */
  private webAppUrl(): string | undefined {
    return this.config.get<string>('WEBAPP_URL')?.trim() || undefined;
  }

  /** A standard "back to menu" footer, optionally prefixed with extra buttons. */
  private footer(extra: ReturnType<typeof Markup.button.callback>[] = []) {
    return Markup.inlineKeyboard([
      [...extra, Markup.button.callback('« Menu', 'nav:menu')],
    ]);
  }

  /** Telegram's native share sheet, pre-filled with the referral link + pitch. */
  private shareUrl(link: string): string {
    const text = 'Hunt airdrops safely with SwiftyDrop Guard 🛡️';
    return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  }

  /** Pull the first usable http(s) link out of an airdrop's `socialLinks` JSON. */
  private firstLink(links: unknown): string | undefined {
    if (!links || typeof links !== 'object') return undefined;
    const entries = links as Record<string, unknown>;
    // Prefer an official site/homepage key before falling back to any link.
    const preferred = ['website', 'site', 'homepage', 'url'];
    for (const key of preferred) {
      const v = entries[key];
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
    }
    for (const v of Object.values(entries)) {
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
    }
    return undefined;
  }

  /** Bare hostname (no `www.`) of a URL, or undefined if it won't parse. */
  private hostOf(url: string): string | undefined {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }

  /** Clamp text to `max` chars for button labels (Telegram caps these). */
  private truncate(s: string, max: number): string {
    return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
  }

  /** Escape the Markdown control chars that break Telegram's legacy Markdown parser. */
  private md(s: string): string {
    return String(s).replace(/([_*`\[])/g, '\\$1');
  }

  private helpText(): string {
    return (
      'Commands:\n' +
      TelegramBotService.COMMANDS.map(
        (c) => `/${c.command} — ${c.description}`,
      ).join('\n')
    );
  }
}
