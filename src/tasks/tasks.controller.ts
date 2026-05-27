import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  // GET /tasks/:userId
  @Get(':userId')
  list(@Param('userId') userId: string) {
    return this.tasks.forUser(userId);
  }

  // POST /tasks/update
  @Post('update')
  update(
    @Body('taskId') taskId: string,
    @Body('status') status?: string,
    @Body('progress') progress?: number,
  ) {
    return this.tasks.update(taskId, { status, progress });
  }

  // Helper: provision checklist for a user/airdrop pair.
  @Post('checklist')
  ensureChecklist(@Body('userId') userId: string, @Body('airdropId') airdropId: string) {
    return this.tasks.ensureChecklist(userId, airdropId);
  }
}
