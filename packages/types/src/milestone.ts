export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  targetDate?: Date | null;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
