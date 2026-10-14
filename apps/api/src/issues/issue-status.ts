import { inArray } from 'drizzle-orm';
import { teamWorkflowStates, type DbClient } from '@reka/database';
import { DEFAULT_TEAM_WORKFLOW_STATES } from '../teams/workflow-state-defaults';

export async function loadIssueStatusCategories(db: DbClient, teamIds: string[]) {
  const categories = new Map<string, string>();
  if (teamIds.length) {
    const configured = await db.select({ teamId: teamWorkflowStates.teamId, key: teamWorkflowStates.key, category: teamWorkflowStates.category })
      .from(teamWorkflowStates).where(inArray(teamWorkflowStates.teamId, [...new Set(teamIds)]));
    for (const state of configured) categories.set(`${state.teamId}:${state.key}`, state.category);
  }
  return categories;
}

export function getIssueStatusCategory(issue: { teamId: string; status: string }, categories: Map<string, string>) {
  return categories.get(`${issue.teamId}:${issue.status}`) ?? DEFAULT_TEAM_WORKFLOW_STATES.find((state) => state.key === issue.status)?.category ?? 'started';
}
