export interface Cycle {
  id: string;
  teamId: string;
  number: number;
  name?: string | null;
  startDate: Date;
  endDate: Date;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
