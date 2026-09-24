export interface Team {
  id: string;
  organizationId: string;
  name: string;
  key: string; // e.g. "RS" for issue identifiers like "RS-123"
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
