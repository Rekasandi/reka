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
  Hash,
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
  SidebarRail,
  SidebarSeparator,
} from '@reka/ui';
import { useTeams } from '../../features/teams/hooks/use-teams';

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

  const isCurrent = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

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
                <span className="truncate text-[10px] text-muted-foreground font-mono">REKA Platform</span>
              </div>
              <ChevronDown className="ml-auto size-3.5 opacity-50" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Workspace Core Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {coreNav.map((item) => {
                const Icon = item.icon;
                const active = isCurrent(item.to);
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

        {/* Dynamic Teams in Sidebar (Linear-style) */}
        {teams.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
                Your Teams
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {teams.map((t) => (
                    <SidebarMenuItem key={t.id}>
                      <SidebarMenuButton asChild isActive={isCurrent(`/teams/${t.id}`)} tooltip={`${t.name} (${t.key})`}>
                        <Link to={`/teams/${t.id}`}>
                          <span className="size-4.5 rounded-[4px] bg-secondary flex items-center justify-center text-[10px] font-mono font-semibold text-foreground shrink-0 border border-border/70">
                            {t.key.slice(0, 2)}
                          </span>
                          <span className="truncate">{t.name}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {t.key}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarSeparator />

        {/* Organization Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
            Organization
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orgNav.map((item) => {
                const Icon = item.icon;
                const active = isCurrent(item.to);
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
