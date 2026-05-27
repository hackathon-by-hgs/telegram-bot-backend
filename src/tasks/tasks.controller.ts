import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { EnsureChecklistDto, UpdateTaskDto } from './dto/tasks.dto';
import { AirdropTaskDto } from '../common/dto/models.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'List a user’s tasks',
    description: 'Returns every airdrop task assigned to a user across all airdrops, with the parent airdrop’s name and deadline joined in.',
  })
  @ApiParam({ name: 'userId', description: 'User ID (CUID)', example: 'ckxk7g2v90000abcd1234efgh' })
  @ApiOkResponse({ type: [AirdropTaskDto] })
  list(@Param('userId') userId: string) {
    return this.tasks.forUser(userId);
  }

  @Post('update')
  @ApiOperation({
    summary: 'Update a task’s status or progress',
    description:
      'Either field is optional. Transitioning `status` to `completed` stamps `completedAt` and emits `TASK_COMPLETED` (which the gamification module listens to for XP grants).',
  })
  @ApiOkResponse({ type: AirdropTaskDto })
  update(@Body() dto: UpdateTaskDto) {
    return this.tasks.update(dto.taskId, { status: dto.status, progress: dto.progress });
  }

  @Post('checklist')
  @ApiOperation({
    summary: 'Provision the default checklist for a user/airdrop pair',
    description:
      'Idempotent — if any tasks already exist for the (userId, airdropId) pair, the existing rows are returned unchanged. Otherwise the default task template is created.',
  })
  @ApiOkResponse({ type: [AirdropTaskDto] })
  ensureChecklist(@Body() dto: EnsureChecklistDto) {
    return this.tasks.ensureChecklist(dto.userId, dto.airdropId);
  }
}
