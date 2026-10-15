import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, Box, Building2, CalendarDays, ChevronDown, CircleArrowRight,
  CircleDot, Ellipsis, FileText, Focus, Home, Inbox, Layers2,
  LayoutDashboard, LockKeyhole, PanelsTopLeft, Plus, Settings, Target,
  UserCheck, Users, type LucideIcon,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
  SidebarRail, Collapsible, CollapsibleTrigger, CollapsibleContent, Skeleton,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuItem, useSidebar,
} from '@reka/ui';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth.store';
import { getWorkspace, WORKSPACE_QUERY_KEY } from '../../features/settings/api/workspace.api';
import { useTeams } from '../../features/teams/hooks/use-teams';
import { useUnreadCount } from '../../features/notifications/hooks/use-notifications';
import { useFavorites } from '../../features/views/hooks/use-views';
import { useTriage } from '../../features/issues/hooks/use-triage';
import { resolveEntityIcon } from '../entity-icon-picker';

type NavItem = { label: string; to: string; icon: LucideIcon; count?: number };
const workspaceNav: NavItem[] = [
  { label: 'Initiatives', to: '/initiatives', icon: Target },
  { label: 'Projects', to: '/projects', icon: Box },
  { label: 'Views', to: '/views', icon: Layers2 },
];
const moreNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'All Issues', to: '/issues', icon: PanelsTopLeft },
  { label: 'Triage', to: '/triage', icon: CircleArrowRight },
  { label: 'Roadmap', to: '/roadmap', icon: CalendarDays },
  { label: 'Documents', to: '/documents', icon: FileText },
  { label: 'Cycles', to: '/cycles', icon: CircleDot },
  { label: 'Insights', to: '/insights', icon: Activity },
  { label: 'Favorites', to: '/favorites', icon: Layers2 },
  { label: 'Teams', to: '/teams', icon: Users },
  { label: 'Users', to: '/users', icon: UserCheck },
  { label: 'Clients', to: '/clients', icon: Building2 },
];
const favoriteIcons = { issue: PanelsTopLeft, project: Box, view: Layers2, document: FileText };

function SidebarSection({ label, action, children }: {
  label: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return <Collapsible defaultOpen className="group/nav-section">
    <SidebarGroup>
      <SidebarGroupLabel className="gap-2">
        <CollapsibleTrigger className="flex min-w-0 items-center gap-1.5 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span>{label}</span>
          <ChevronDown aria-hidden="true" className="size-3 transition-transform group-data-[state=closed]/nav-section:-rotate-90" />
        </CollapsibleTrigger>
        {action}
      </SidebarGroupLabel>
      <CollapsibleContent><SidebarGroupContent>{children}</SidebarGroupContent></CollapsibleContent>
    </SidebarGroup>
  </Collapsible>;
}

export function AppSidebar() {
  const location = useLocation();
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError, refetch: retryTeams } = useTeams();
  const { data: unreadData } = useUnreadCount();
  const { data: workspace } = useQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: getWorkspace });
  const { data: favorites = [], isLoading: favoritesLoading, isError: favoritesError, refetch: retryFavorites } = useFavorites();
  const { data: triage } = useTriage();
  const role = useAuthStore(state => state.user?.role);
  const canCreateTeam = role === 'owner' || role === 'admin' || role === 'member';
  const { setOpenMobile } = useSidebar();
  const search = new URLSearchParams(location.search);
  const scopedTeamId = location.pathname.startsWith('/teams/')
    ? location.pathname.split('/')[2] : search.get('teamId');
  const [expandedTeams, setExpandedTeams] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => { setOpenMobile(false); }, [location.pathname, location.search, setOpenMobile]);
  React.useEffect(() => {
    if (scopedTeamId) setExpandedTeams(current => ({ ...current, [scopedTeamId]: true }));
  }, [scopedTeamId]);

  const isCurrent = (href: string) => {
    const [path, query] = href.split('?');
    if (location.pathname !== path && !(!path.startsWith('/teams') && location.pathname.startsWith(`${path}/`))) return false;
    const target = new URLSearchParams(query);
    if (target.get('teamId') !== (search.get('teamId') || null)) return false;
    if (path === '/cycles' && (target.get('status') || 'all') !== (search.get('status') || 'all')) return false;
    if (/^\/teams\/[^/]+$/.test(path) && (target.get('tab') || 'home') !== (search.get('tab') || 'home')) return false;
    return [...target].every(([key, value]) => search.get(key) === value);
  };
  const navItem = (item: NavItem, nested = false) => {
    const active = isCurrent(item.to);
    const Icon = item.icon;
    const content = <Link to={item.to} aria-current={active ? 'page' : undefined} title={item.label}>
      <Icon aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.count !== undefined && item.count > 0 && <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-label={`${item.count} ${item.to === '/inbox' ? 'unread notifications' : 'issues awaiting review'}`}>{item.count}</span>}
    </Link>;
    return nested
      ? <SidebarMenuSubItem key={item.to}><SidebarMenuSubButton asChild isActive={active}>{content}</SidebarMenuSubButton></SidebarMenuSubItem>
      : <SidebarMenuItem key={item.to}><SidebarMenuButton asChild isActive={active} tooltip={item.label}>{content}</SidebarMenuButton></SidebarMenuItem>;
  };

  return <Sidebar collapsible="icon">
    <SidebarHeader>
      <SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild tooltip="Workspace home">
        <Link to="/dashboard" aria-label="Workspace home">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-primary text-xs font-semibold text-primary-foreground">R</span>
          <span className="truncate font-semibold tracking-tight">{workspace?.name || 'REKA'}</span>
        </Link>
      </SidebarMenuButton></SidebarMenuItem></SidebarMenu>
    </SidebarHeader>

    <SidebarContent className="reka-sidebar-nav">
      <SidebarGroup aria-label="Personal">
        <SidebarGroupContent><SidebarMenu>
          {navItem({ label: 'Inbox', to: '/inbox', icon: Inbox, count: unreadData?.count })}
          {navItem({ label: 'My issues', to: '/my-issues', icon: Focus })}
        </SidebarMenu></SidebarGroupContent>
      </SidebarGroup>

      <SidebarSection label="Workspace">
        <SidebarMenu>
          {workspaceNav.map(item => navItem(item))}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton isActive={moreNav.some(item => isCurrent(item.to))} tooltip="More" aria-label="More workspace pages">
                  <Ellipsis aria-hidden="true" /><span>More</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuGroup>{moreNav.map(item => <DropdownMenuItem asChild key={item.to}>
                  <Link to={item.to} aria-current={isCurrent(item.to) ? 'page' : undefined}><item.icon aria-hidden="true" />{item.label}</Link>
                </DropdownMenuItem>)}</DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarSection>

      <SidebarSection label="Favorites">
        <SidebarMenu>
          {favoritesLoading && [0, 1].map(index => <SidebarMenuItem key={index}><Skeleton className="h-8 w-full" /></SidebarMenuItem>)}
          {favoritesError && <SidebarMenuItem><SidebarMenuButton onClick={() => void retryFavorites()}>Retry loading favorites</SidebarMenuButton></SidebarMenuItem>}
          {!favoritesLoading && !favoritesError && !favorites.length && <SidebarMenuItem><SidebarMenuButton asChild><Link to="/favorites"><Layers2 aria-hidden="true" /><span>No favorites yet</span></Link></SidebarMenuButton></SidebarMenuItem>}
          {favorites.map(item => navItem({ label: item.name, to: item.href, icon: favoriteIcons[item.resourceType] }))}
        </SidebarMenu>
      </SidebarSection>

      <SidebarSection label="Your teams" action={canCreateTeam && <Link to="/teams?create=1" className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-sm hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="New team"><Plus className="size-3.5" /></Link>}>
        <SidebarMenu>
          {teamsLoading && [0, 1].map(index => <SidebarMenuItem key={index}><Skeleton className="h-8 w-full" /></SidebarMenuItem>)}
          {teamsError && <SidebarMenuItem><SidebarMenuButton onClick={() => void retryTeams()}>Retry loading teams</SidebarMenuButton></SidebarMenuItem>}
          {!teamsLoading && !teamsError && !teams.length && <SidebarMenuItem><SidebarMenuButton asChild><Link to="/teams">Browse teams</Link></SidebarMenuButton></SidebarMenuItem>}
          {teams.map((team, index) => {
            const TeamIcon = resolveEntityIcon(team.icon);
            const query = `teamId=${encodeURIComponent(team.id)}`;
            const teamNav: NavItem[] = [
              { label: 'Overview', to: `/teams/${team.id}`, icon: Home },
              { label: 'Members', to: `/teams/${team.id}?tab=members`, icon: Users },
              { label: 'Triage', to: `/triage?${query}`, icon: CircleArrowRight, count: triage?.filter(issue => issue.teamId === team.id).length },
              { label: 'Issues', to: `/teams/${team.id}/issues`, icon: PanelsTopLeft },
              { label: 'Cycles', to: `/cycles?${query}`, icon: CircleDot },
              { label: 'Initiatives', to: `/initiatives?${query}`, icon: Target },
              { label: 'Projects', to: `/projects?${query}`, icon: Box },
              { label: 'Views', to: `/views?${query}`, icon: Layers2 },
            ];
            return <SidebarMenuItem key={team.id}>
              <Collapsible open={expandedTeams[team.id] ?? (scopedTeamId ? scopedTeamId === team.id : index === 0)} onOpenChange={open => setExpandedTeams(current => ({ ...current, [team.id]: open }))} className="group/team-item">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton tooltip={`${team.name} (${team.key})`} aria-label={`${team.name} (${team.key})`}>
                    <TeamIcon aria-hidden="true" /><span className="min-w-0 truncate">{team.name}</span>
                    {team.isPrivate && <LockKeyhole aria-label="Private team" className="size-3!" />}
                    <ChevronDown aria-hidden="true" className="size-3! shrink-0 transition-transform group-data-[state=closed]/team-item:-rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="reka-team-menu">
                    {teamNav.map(item => <React.Fragment key={item.to}>
                      {navItem(item, true)}
                      {item.label === 'Cycles' && <SidebarMenuSubItem><SidebarMenuSub className="reka-cycle-menu">
                        {navItem({ label: 'Current', to: `/cycles?${query}&status=active`, icon: CircleDot }, true)}
                        {navItem({ label: 'Upcoming', to: `/cycles?${query}&status=upcoming`, icon: CircleDot }, true)}
                      </SidebarMenuSub></SidebarMenuSubItem>}
                    </React.Fragment>)}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>;
          })}
        </SidebarMenu>
      </SidebarSection>
    </SidebarContent>

    <SidebarFooter><SidebarMenu>{navItem({ label: 'Settings', to: '/settings', icon: Settings })}</SidebarMenu></SidebarFooter>
    <SidebarRail />
  </Sidebar>;
}
