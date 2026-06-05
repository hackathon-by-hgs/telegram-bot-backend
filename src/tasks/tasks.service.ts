import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EVENTS } from '../events/event-names';

// Spec §2.7 default checklist.
export const DEFAULT_TASK_TEMPLATE = [
  'Follow Twitter',
  'Join Telegram',
  'Join Discord',
  'Connect Wallet',
  'Submit Wallet Address',
  'Share Referral Link',
] as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async forUser(userId: string) {
    return this.prisma.airdropTask.findMany({
      where: { userId },
      include: { airdrop: { select: { name: true, deadline: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Lazily provisions the default template per user/airdrop pair. */
  async ensureChecklist(userId: string, airdropId: string) {
    const existing = await this.prisma.airdropTask.findFirst({
      where: { userId, airdropId },
    });
    if (existing)
      return this.prisma.airdropTask.findMany({ where: { userId, airdropId } });

    await this.prisma.airdropTask.createMany({
      data: DEFAULT_TASK_TEMPLATE.map((label) => ({
        userId,
        airdropId,
        label,
      })),
    });
    return this.prisma.airdropTask.findMany({ where: { userId, airdropId } });
  }

  async update(taskId: string, patch: { status?: string; progress?: number }) {
    const task = await this.prisma.airdropTask.findUnique({
      where: { id: taskId },
    });
    if (!task) throw new NotFoundException();

    const willComplete =
      patch.status === 'completed' && task.status !== 'completed';
    const updated = await this.prisma.airdropTask.update({
      where: { id: taskId },
      data: {
        status: patch.status ?? task.status,
        progress: patch.progress ?? task.progress,
        completedAt: willComplete ? new Date() : task.completedAt,
      },
    });

    if (willComplete) {
      this.events.emit(EVENTS.TASK_COMPLETED, {
        userId: task.userId,
        taskId: task.id,
        airdropId: task.airdropId,
        label: task.label,
      });
    }
    return updated;
  }
}
