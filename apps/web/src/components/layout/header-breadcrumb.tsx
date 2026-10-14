import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@reka/ui';
import { useTeam } from '../../features/teams/hooks/use-teams';
import { useProject } from '../../features/projects/hooks/use-projects';
import { useCycle } from '../../features/cycles/hooks/use-cycles';
import { useDocument } from '../../features/projects/hooks/use-documents';
import { useInitiative } from '../../features/initiatives/hooks/use-initiatives';

const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  inbox: 'Inbox',
  triage: 'Triage',
  favorites: 'Favorites',
  views: 'Views',
  initiatives: 'Initiatives',
  roadmap: 'Roadmap',
  documents: 'Documents',
  'my-issues': 'My Issues',
  issues: 'Issues',
  projects: 'Projects',
  cycles: 'Cycles',
  insights: 'Insights',
  teams: 'Teams',
  users: 'Users',
  clients: 'Clients',
  settings: 'Settings',
};

export function HeaderBreadcrumb() {
  const { pathname, search } = useLocation();
  const [section = 'dashboard', resourceId, child] = pathname.split('/').filter(Boolean);
  const isTeamScopedSection = ['projects', 'cycles', 'triage', 'initiatives', 'views'].includes(section);
  const teamId = section === 'teams'
    ? resourceId
    : isTeamScopedSection ? new URLSearchParams(search).get('teamId') ?? undefined : undefined;
  const { data: team } = useTeam(teamId);
  const { data: project } = useProject(section === 'projects' ? resourceId : undefined);
  const { data: cycle } = useCycle(section === 'cycles' ? resourceId : undefined);
  const { data: document } = useDocument(section === 'documents' ? resourceId : undefined);
  const { data: initiative } = useInitiative(section === 'initiatives' ? resourceId : undefined);

  const items = [{ label: 'Dashboard', to: '/dashboard' }];
  if (section !== 'dashboard') {
    if (teamId && isTeamScopedSection) {
      items.push(
        { label: 'Teams', to: '/teams' },
        { label: team?.name || 'Team', to: `/teams/${teamId}` },
      );
    }
    items.push({ label: PAGE_LABELS[section] || 'Page', to: `/${section}${isTeamScopedSection ? search : ''}` });
    if (resourceId) {
      const label = section === 'teams' ? team?.name || 'Team'
        : section === 'projects' ? project?.name || 'Project'
        : section === 'cycles' ? cycle?.name || (cycle ? `Cycle ${cycle.number}` : 'Cycle')
        : section === 'documents' ? document?.title || 'Document'
        : section === 'initiatives' ? initiative?.name || 'Initiative'
        : 'Details';
      items.push({ label, to: `/${section}/${resourceId}${search}` });
    }
    if (child) items.push({ label: PAGE_LABELS[child] || 'Page', to: pathname + search });
  }

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap gap-1.5 text-xs">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          // Keep the parent and current page visible on narrow headers.
          const visibility = index < items.length - 2 ? 'hidden lg:inline-flex' : '';
          return (
            <Fragment key={item.to}>
              {index > 0 && <BreadcrumbSeparator className={`shrink-0 ${index < items.length - 1 ? 'hidden lg:inline-flex' : ''}`} />}
              <BreadcrumbItem className={`min-w-0 ${isCurrent ? '' : 'shrink-0'} ${visibility}`}>
                {isCurrent ? (
                  <BreadcrumbPage className="truncate" title={item.label}>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link
                      to={item.to}
                      className="max-w-36 truncate rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={item.label}
                    >
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
