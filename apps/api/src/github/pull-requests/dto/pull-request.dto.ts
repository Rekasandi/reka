import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateOrLinkPRDto {
  @IsUUID()
  issueId!: string;

  @IsUUID()
  repositoryId!: string;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  prNumber!: number;
}
