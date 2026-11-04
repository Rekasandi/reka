import { IsIn, IsOptional, IsUUID } from 'class-validator';

export const REACTION_EMOJIS = ['👍', '👎', '❤️', '🎉', '😄', '😕', '🚀', '👀'] as const;

/** Toggle one emoji on exactly one target: an issue or a comment. */
export class ToggleReactionDto {
  @IsOptional() @IsUUID() issueId?: string;
  @IsOptional() @IsUUID() commentId?: string;
  @IsIn([...REACTION_EMOJIS]) emoji!: string;
}
