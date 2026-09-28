import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  FolderKanban,
  RotateCcw,
  Users,
  UserCheck,
  Building2,
  Settings,
  ChevronDown,
  Home,
  Plus,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarSeparator,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@reka/ui';
import { useTeams } from '../../features/teams/hooks/use-teams';
import { useUnreadCount } from '../../features/notifications/hooks/use-notifications';

const coreNav = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Inbox', to: '/inbox', icon: Inbox },
  { label: 'My Issues', to: '/my-issues', icon: CheckSquare },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Cycles', to: '/cycles', icon: RotateCcw },
];

const orgNav = [
  { label: 'Teams', to: '/teams', icon: Users },
  { label: 'Users', to: '/users', icon: UserCheck },
  { label: 'Clients', to: '/clients', icon: Building2 },
];

export function AppSidebar() {
  const location = useLocation();
  const { data: teams = [] } = useTeams();
  const { data: unreadData } = useUnreadCount();

  const isCurrent = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isTeamScoped = new URLSearchParams(location.search).has('teamId');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <div className="flex aspect-square size-6 items-center justify-center rounded-[4px] bg-primary text-primary-foreground font-semibold text-xs">
                R
              </div>
              <div className="grid flex-1 text-left text-xs leading-tight">
                <span className="truncate font-semibold tracking-tight">Rekasandi</span>
                <span className="truncate text-xs text-muted-foreground">REKA Platform</span>
              </div>
              <ChevronDown className="ml-auto size-3.5 opacity-50" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Workspace Core Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreNav.map((item) => {
                const Icon = item.icon;
                const active = isCurrent(item.to) && !(isTeamScoped && (item.to === '/projects' || item.to === '/cycles'));
                const isInbox = item.to === '/inbox';
                const unreadCount = isInbox ? (unreadData?.count ?? 0) : 0;

                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Icon />
                          <span>{item.label}</span>
                        </div>
                        {unreadCount > 0 && (
                          <span className="flex items-center justify-center h-4 min-w-[16px] px-1 text-xs font-mono font-medium rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
                            {unreadCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Teams Collapsible Section (Exact match to Linear screenshot) */}
        <SidebarSeparator />
        <Collapsible defaultOpen className="group/teams-section">
          <SidebarGroup>
            <SidebarGroupLabel className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground">
              <CollapsibleTrigger className="flex min-w-0 flex-1 items-center justify-between hover:text-foreground cursor-pointer select-none">
                <span>Your teams</span>
                <ChevronDown className="size-3 text-muted-foreground transition-transform duration-200 group-data-[state=closed]/teams-section:-rotate-90" />
              </CollapsibleTrigger>
              <Link
                to="/teams?create=1"
                className="ml-2 inline-flex size-5 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                title="New team"
              >
                <Plus className="size-3.5" />
              </Link>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {(teams.length > 0 ? teams : [{ id: 'default', name: 'Rekasandi', key: 'RS' }]).map((t) => {
                    const isTeamActive = isCurrent(`/teams/${t.id}`);
                    return (
                      <Collapsible
                        key={t.id}
                        defaultOpen
                        className="group/team-item"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={`${t.name} (${t.key})`}
                              className="w-full justify-between font-medium cursor-pointer"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="flex size-5 items-center justify-center rounded-[4px] border border-sidebar-border bg-sidebar-accent text-xs font-semibold text-sidebar-foreground">
                                  {t.key.slice(0, 1)}
                                </span>
                                <span className="truncate text-xs font-medium">{t.name}</span>
                              </div>
                              <ChevronDown className="size-3 text-muted-foreground/60 transition-transform duration-200 group-data-[state=closed]/team-item:-rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-4 border-l border-border/60 pl-2 space-y-0.5">
                              {/* Subitem: Home */}
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={location.pathname === `/teams/${t.id}`}>
                                  <Link
                                    to={t.id === 'default' ? '/dashboard' : `/teams/${t.id}`}
                                    className="flex items-center gap-2 text-xs py-1"
                                  >
                                    <Home className="size-3.5 text-muted-foreground" />
                                    <span>Home</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>

                              {/* Subitem: Issues */}
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={
                                    location.pathname === `/teams/${t.id}/issues`
                                  }
                                >
                                  <Link
                                    to={t.id === 'default' ? '/issues' : `/teams/${t.id}/issues`}
                                    className="flex items-center gap-2 text-xs py-1"
                                  >
                                    <CheckSquare className="size-3.5 text-muted-foreground" />
                                    <span>Issues</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>

                              {/* Subitem: Projects */}
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={location.pathname.startsWith('/projects') && new URLSearchParams(location.search).get('teamId') === t.id}
                                >
                                  <Link
                                    to={t.id === 'default' ? '/projects' : `/projects?teamId=${t.id}`}
                                    className="flex items-center gap-2 text-xs py-1"
                                  >
                                    <FolderKanban className="size-3.5 text-muted-foreground" />
                                    <span>Projects</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>

                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarSeparator />

        {/* Organization Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
            Organization
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orgNav.map((item) => {
                const Icon = item.icon;
                const active = item.to === '/teams' ? location.pathname === '/teams' : isCurrent(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isCurrent('/settings')} tooltip="Settings">
              <Link to="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
