export interface InsightsFilters { teamId?: string; projectId?: string; viewId?: string; from: string; to: string; timezone: string; page?: number; pageSize?: number }
export interface MetricSample { sampleSize: number; missingHistoryCount: number; averageHours: number | null; medianHours: number | null; points: { date: string; sampleSize: number; averageHours: number }[] }
export interface InsightsOverview {
  range: { from: string; to: string; timezone: string };
  filters: { teamId: string | null; projectId: string | null; viewId: string | null };
  history: { hasHistory: boolean; measuredEventCount: number; baselineIssueCount: number; issuesWithCreationHistory: number; historyStartsAt: string | null };
  throughput: { total: number; sampleSize: number; repeatedCompletionEvents: number; baselineCompletionCount: number; points: { date: string; count: number }[] };
  leadTime: MetricSample; cycleTime: MetricSample;
  completions: { page: number; pageSize: number; total: number; totalPages: number; rows: { issueId: string; identifier: string | null; title: string | null; teamId: string; completedAt: string; projectId: string | null }[] };
  quality: { missingCreationHistoryCount: number; missingStartHistoryCount: number; explanation: string };
}
export interface CycleInsights {
  filters: { teamId: string | null; cycleId: string | null; unit: 'issues' | 'estimate' };
  velocity: { sampleSize: number; unmeasuredCompletedCycles: number; scopeTruncated: boolean; points: { cycleId: string; cycleName: string; measuredAt: string; completedIssues: number; completedEstimate: number; missingEstimateCount: number; value: number; unit: string }[] };
  burndown: { cycle: { id: string; name: string; startDate: string; endDate: string } | null; hasHistory: boolean; historyStartsAt: string | null; truncated: boolean; sampleSize: number; points: { snapshotAt: string; totalIssueCount: number; completedIssueCount: number; remainingIssueCount: number; plannedEstimate: number; completedEstimate: number; remainingEstimate: number; missingEstimateCount: number; value: number }[] };
  quality: { message: string };
}

function queryString(params: object) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  return search.toString();
}
async function get<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Could not load insights');
  return response.json();
}
export const getInsightsOverview = (filters: InsightsFilters) => get<InsightsOverview>(`/api/insights/overview?${queryString(filters)}`);
export const getCycleInsights = (filters: InsightsFilters & { cycleId?: string; unit: 'issues' | 'estimate' }) => get<CycleInsights>(`/api/insights/cycles?${queryString(filters)}`);
