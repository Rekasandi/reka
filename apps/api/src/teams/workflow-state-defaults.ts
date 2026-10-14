export const DEFAULT_TEAM_WORKFLOW_STATES = [
  { key: 'backlog', name: 'Backlog', category: 'backlog', color: '#8f8f8f', position: 0 },
  { key: 'todo', name: 'Todo', category: 'unstarted', color: '#b0b0b0', position: 1 },
  { key: 'in_progress', name: 'In Progress', category: 'started', color: '#f5a623', position: 2 },
  { key: 'in_review', name: 'In Review', category: 'started', color: '#50e3c2', position: 3 },
  { key: 'ready_to_deploy', name: 'Ready to Deploy', category: 'started', color: '#0070f3', position: 4 },
  { key: 'done', name: 'Done', category: 'completed', color: '#7928ca', position: 5 },
  { key: 'canceled', name: 'Canceled', category: 'canceled', color: '#8f8f8f', position: 6 },
  { key: 'blocked', name: 'Blocked', category: 'started', color: '#ee0000', position: 7 },
  { key: 'triage', name: 'Triage', category: 'triage', color: '#ec9a3c', position: 8 },
] as const;
