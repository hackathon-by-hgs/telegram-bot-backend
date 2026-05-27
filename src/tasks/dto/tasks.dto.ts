import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const TASK_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export class UpdateTaskDto {
  @ApiProperty({ description: 'Task ID', example: 'ckxk7g2v90200abcd1234efgh' })
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @ApiPropertyOptional({
    description: 'New lifecycle status. Setting to `completed` stamps `completedAt` and emits `TASK_COMPLETED`.',
    enum: TASK_STATUSES,
    example: 'completed',
  })
  @IsOptional()
  @IsIn(TASK_STATUSES as unknown as string[])
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Progress percentage (0-100). Independent of `status`.',
    example: 100,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
}

export class EnsureChecklistDto {
  @ApiProperty({ example: 'ckxk7g2v90000abcd1234efgh' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'ckxk7g2v90100abcd1234efgh' })
  @IsString()
  @IsNotEmpty()
  airdropId!: string;
}
