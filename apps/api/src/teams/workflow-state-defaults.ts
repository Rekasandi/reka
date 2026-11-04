export const DEFAULT_TEAM_WORKFLOW_STATES = [
  { key: 'backlog', name: 'Backlog', category: 'backlog', color: '#8f8f8f', position: 0 },
  { key: 'todo', name: 'Todo', category: 'unstarted', color: '#b0b0b0', position: 1 },
  { key: 'in_progress', name: 'In Progress', category: 'started', color: '#f5a623', position: 2 },
  { key: 'in_review', name: 'In Review', category: 'started', color: '#50e3c2', position: 3 },
  { key: 'ready_to_deploy', name: 'Ready to Deploy', category: 'started', color: '#0070f3', position: 4 },
  { key: 'done', name: 'Done', category: 'completed', color: '#7928ca', position: 5 },
  { key: 'canceled', name: 'Canceled', category: 'canceled', color: '#8f8f8f', position: 6 },
  { key: 'duplicate', name: 'Duplicate', category: 'canceled', color: '#8f8f8f', position: 7 },
  { key: 'triage', name: 'Triage', category: 'triage', color: '#ec9a3c', position: 8 },
] as const;
// Like Linear, "blocked" is a relation (blocked by), not a status. Existing teams keep their own `blocked` state.

/** Workflow fields on `teams` that point at a state key ('-' and null are not keys). */
export const TEAM_STATUS_REFERENCES = ['defaultStatus', 'duplicateStatus', 'githubDraftStatus', 'githubOpenStatus', 'githubMergedStatus'] as const;

type StateLike = { key: string; category: string; isActive: boolean };
/** First active state for new issues: the team's choice, else the first unstarted, else backlog. */
export function resolveDefaultStatus(states: StateLike[], chosen: string | null | undefined) {
  if (!states.length) return chosen || 'todo';
  const active = states.filter((state) => state.isActive);
  return (chosen && active.find((state) => state.key === chosen)?.key)
    ?? active.find((state) => state.category === 'unstarted')?.key ?? active.find((state) => state.category === 'backlog')?.key ?? null;
}
