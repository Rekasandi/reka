import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, Box, Building2, ChevronDown, CircleArrowRight,
  CircleDot, Ellipsis, FileText, Focus, Home, Inbox, Layers2,
  LayoutDashboard, LockKeyhole, PanelsTopLeft, Plus, Settings,
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
import { useAuth } from '../../features/auth/hooks/use-auth';
import { WorkspaceSwitcher } from './workspace-switcher';
import { useTeams } from '../../features/teams/hooks/use-teams';
import { useUnreadCount } from '../../features/notifications/hooks/use-notifications';
import { useFavorites } from '../../features/favorites/hooks/use-favorites';
import { useTriage } from '../../features/issues/hooks/use-triage';
import { resolveEntityIcon } from '../entity-icon-picker';

type NavItem = { label: string; to: string; icon: LucideIcon; count?: number };
const workspaceNav: NavItem[] = [
  { label: 'Projects', to: '/projects', icon: Box },
  { label: 'Teams', to: '/teams', icon: Users },
  { label: 'Users', to: '/users', icon: UserCheck },
];
const moreNav: NavItem[] = [
  { label: 'All Issues', to: '/issues', icon: PanelsTopLeft },
  { label: 'Triage', to: '/triage', icon: CircleArrowRight },
  { label: 'Documents', to: '/documents', icon: FileText },
  { label: 'Cycles', to: '/cycles', icon: CircleDot },
  { label: 'Insights', to: '/insights', icon: Activity },
  { label: 'Favorites', to: '/favorites', icon: Layers2 },
  { label: 'Clients', to: '/clients', icon: Building2 },
];
const favoriteIcons = { issue: PanelsTopLeft, project: Box, document: FileText };

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
  // The workspace-wide Cycles page is only useful while at least one team still has cycles switched on.
  const showCycles = teams.length === 0 || teams.some(team => team.cyclesEnabled !== false);
  const showTriage = teams.length === 0 || teams.some(team => team.triageEnabled !== false);
  const visibleMoreNav = moreNav.filter(item => (item.to !== '/cycles' || showCycles) && (item.to !== '/triage' || showTriage));
  const { data: unreadData } = useUnreadCount();
  const { data: favorites = [], isLoading: favoritesLoading, isError: favoritesError, refetch: retryFavorites } = useFavorites();
  const { data: triage } = useTriage();
  const role = useAuth().user?.role;
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
      <SidebarMenu><SidebarMenuItem><WorkspaceSwitcher /></SidebarMenuItem></SidebarMenu>
    </SidebarHeader>

    <SidebarContent className="reka-sidebar-nav">
      <SidebarGroup aria-label="Personal">
        <SidebarGroupContent><SidebarMenu>
          {navItem({ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard })}
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
                <SidebarMenuButton isActive={visibleMoreNav.some(item => isCurrent(item.to))} tooltip="More" aria-label="More workspace pages">
                  <Ellipsis aria-hidden="true" /><span>More</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuGroup>{visibleMoreNav.map(item => <DropdownMenuItem asChild key={item.to}>
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
              ...(team.triageEnabled !== false ? [{ label: 'Triage', to: `/triage?${query}`, icon: CircleArrowRight, count: triage?.filter(issue => issue.teamId === team.id).length }] : []),
              { label: 'Issues', to: `/teams/${team.id}/issues`, icon: PanelsTopLeft },
              ...(team.cyclesEnabled !== false ? [{ label: 'Cycles', to: `/cycles?${query}`, icon: CircleDot }] : []),
              { label: 'Projects', to: `/projects?${query}`, icon: Box },
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
