import { useQuery } from '@tanstack/react-query';
import {
  Activity, Box, Building2, CircleArrowRight, CircleDot, FileText, Layers2,
  PanelsTopLeft, UserCheck, Users, type LucideIcon,
} from 'lucide-react';
import { getWorkspace, WORKSPACE_QUERY_KEY, type Workspace } from '../api/workspace.api';

export type NavPlacement = 'sidebar' | 'more';
export type WorkspaceNavItem = { label: string; to: string; icon: LucideIcon; defaultPlacement: NavPlacement };

/** Every workspace page that can appear in the sidebar, in display order. */
export const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  { label: 'Projects', to: '/projects', icon: Box, defaultPlacement: 'sidebar' },
  { label: 'Teams', to: '/teams', icon: Users, defaultPlacement: 'sidebar' },
  { label: 'Users', to: '/users', icon: UserCheck, defaultPlacement: 'sidebar' },
  { label: 'All Issues', to: '/issues', icon: PanelsTopLeft, defaultPlacement: 'more' },
  { label: 'Triage', to: '/triage', icon: CircleArrowRight, defaultPlacement: 'more' },
  { label: 'Documents', to: '/documents', icon: FileText, defaultPlacement: 'more' },
  { label: 'Cycles', to: '/cycles', icon: CircleDot, defaultPlacement: 'more' },
  { label: 'Insights', to: '/insights', icon: Activity, defaultPlacement: 'more' },
  { label: 'Favorites', to: '/favorites', icon: Layers2, defaultPlacement: 'more' },
  { label: 'Clients', to: '/clients', icon: Building2, defaultPlacement: 'more' },
];

/** Stored in the Better Auth organization metadata, so it is shared by the whole workspace. */
export interface WorkspaceNavigationSettings {
  navigation: Record<string, NavPlacement>;
  features: { clients: boolean };
}

export function parseWorkspaceMetadata(metadata: Workspace['metadata']): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try { const parsed = JSON.parse(metadata); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
}

export function readNavigationSettings(metadata: Workspace['metadata']): WorkspaceNavigationSettings {
  const raw = parseWorkspaceMetadata(metadata) as Partial<WorkspaceNavigationSettings>;
  const navigation: Record<string, NavPlacement> = {};
  for (const item of WORKSPACE_NAV_ITEMS) {
    const stored = raw.navigation?.[item.to];
    navigation[item.to] = stored === 'sidebar' || stored === 'more' ? stored : item.defaultPlacement;
  }
  // Clients is opt-in: hidden everywhere until an admin switches it on.
  return { navigation, features: { clients: raw.features?.clients === true } };
}

export function useWorkspaceNavigation() {
  const workspace = useQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: getWorkspace });
  return { ...readNavigationSettings(workspace.data?.metadata), isLoading: workspace.isLoading };
}
