import { Link } from 'react-router-dom';
import { Check, ChevronsUpDown, Plus, Mail } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, SidebarMenuButton } from '@reka/ui';
import { useAuth } from '../../features/auth/hooks/use-auth';
import { useMyInvitations, useSwitchWorkspace, useWorkspaces } from '../../features/auth/hooks/use-workspaces';

/** Linear-style workspace menu in the sidebar header: switch, create or join a workspace. */
export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const workspaces = useWorkspaces(!!user);
  const invitations = useMyInvitations(!!user);
  const switchWorkspace = useSwitchWorkspace();
  const current = user?.workspace ?? null;
  const pendingInvitations = (invitations.data ?? []).filter(invitation => invitation.status === 'pending').length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Switch workspace" aria-label={`Workspace: ${current?.name || 'none'}`}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-primary text-xs font-semibold text-primary-foreground">{(current?.name || 'R')[0].toUpperCase()}</span>
          <span className="truncate font-semibold tracking-tight">{current?.name || 'Choose workspace'}</span>
          <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{user?.email}</DropdownMenuLabel>
        <DropdownMenuGroup>
          {(workspaces.data ?? []).map(workspace => (
            <DropdownMenuItem key={workspace.id} disabled={switchWorkspace.isPending} onSelect={() => { if (workspace.id !== current?.id) switchWorkspace.mutate(workspace.id); }}>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-muted text-[10px] font-semibold">{workspace.name[0]?.toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id === current?.id && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
          {workspaces.isError && <DropdownMenuItem onSelect={() => void workspaces.refetch()}>Could not load workspaces. Retry</DropdownMenuItem>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link to="/onboarding?create=1"><Plus className="size-3.5" /><span>Create workspace</span></Link></DropdownMenuItem>
        {pendingInvitations > 0 && <DropdownMenuItem asChild><Link to="/onboarding"><Mail className="size-3.5" /><span>Join workspace</span><span className="ml-auto text-xs text-muted-foreground">{pendingInvitations}</span></Link></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
