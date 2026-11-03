export interface Team {
  id: string;
  organizationId: string;
  name: string;
  key: string; // e.g. "RS" for issue identifiers like "RS-123"
  icon?: import('./common').EntityIconName | null;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Selectable estimate scales. `free` keeps the legacy "any whole number 0-100" behaviour. */
export const ESTIMATE_SCALES = ['fibonacci', 'exponential', 'linear', 'free'] as const;
export type EstimateScale = (typeof ESTIMATE_SCALES)[number];
export const DEFAULT_ESTIMATE_SCALE: EstimateScale = 'fibonacci';

export const ESTIMATE_SCALE_VALUES: Record<Exclude<EstimateScale, 'free'>, readonly number[]> = {
  fibonacci: [0, 1, 2, 3, 5, 8, 13, 21],
  exponential: [0, 1, 2, 4, 8, 16, 32],
  linear: [0, 1, 2, 3, 4, 5],
};

export const ESTIMATE_SCALE_LABELS: Record<EstimateScale, string> = {
  fibonacci: 'Fibonacci (0, 1, 2, 3, 5, 8, 13, 21)',
  exponential: 'Exponential (0, 1, 2, 4, 8, 16, 32)',
  linear: 'Linear (0, 1, 2, 3, 4, 5)',
  free: 'Any whole number (0–100)',
};

/** Allowed values for a scale, or `null` when any whole number is accepted. */
export function estimateScaleValues(scale: EstimateScale): readonly number[] | null {
  return scale === 'free' ? null : ESTIMATE_SCALE_VALUES[scale];
}
