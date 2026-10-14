import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class InsightsReportQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() viewId?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
}

export class InsightsCycleQueryDto extends InsightsReportQueryDto {
  @IsOptional() @IsUUID() cycleId?: string;
  @IsOptional() @IsIn(['issues', 'estimate']) unit?: 'issues' | 'estimate';
}
