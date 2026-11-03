import { IsIn, IsUUID } from 'class-validator';

export class FavoriteDto {
  @IsIn(['issue', 'project', 'document']) resourceType!: 'issue' | 'project' | 'document';
  @IsUUID() resourceId!: string;
}
