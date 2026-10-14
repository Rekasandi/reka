import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ConfigureIssueRecurrenceDto {
  @IsInt() @Min(1) @Max(52)
  intervalCount!: number;

  @IsIn(['day', 'week', 'month'])
  unit!: 'day' | 'week' | 'month';

  @IsString() @MaxLength(64)
  timezone!: string;

  @IsDateString({ strict: true })
  nextRunAt!: string;

  @IsInt() @Min(0) @Max(365) @IsOptional()
  dueDateOffsetDays?: number | null;
}
