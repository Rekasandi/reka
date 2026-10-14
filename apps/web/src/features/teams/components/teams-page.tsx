import * as React from 'react';
import { Badge, Button, Skeleton } from '@reka/ui';
import { Plus, Users, CheckSquare, RefreshCw, ChevronRight } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTeams } from '../hooks/use-teams';
import { CreateTeamDialog } from './create-team-dialog';
import { useAuthStore } from '../../../stores/auth.store';

export function TeamsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = React.useState(new URLSearchParams(location.search).get('create') === '1');
  React.useEffect(() => { setIsCreateOpen(new URLSearchParams(location.search).get('create') === '1'); }, [location.search]);
  const { data: teams = [], isLoading, isError, refetch } = useTeams();
  const role = useAuthStore(state => state.user?.role);
  const canCreateTeam = role === 'owner' || role === 'admin' || role === 'member';
  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Teams</h1><Badge variant="outline">{teams.length}</Badge></div>
          <p className="text-xs text-muted-foreground">Teams, members, and the work they own.</p>
        </div>
        {canCreateTeam && <Button onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />New Team</Button>}
      </div>
      {isLoading ? <div role="status" aria-label="Loading teams" className="flex flex-col gap-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div> : isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 py-6"><p className="text-sm text-muted-foreground">Could not load teams.</p><Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>
      ) : teams.length ? (
        <ul aria-label="Teams" className="divide-y divide-border">
          {teams.map(team => <li key={team.id} className="flex items-center gap-3 py-4">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-muted-foreground">{team.key}</span>
            <Link to={`/teams/${team.id}`} aria-label={`Open team ${team.name}`} className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-md p-1 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex min-w-0 flex-col gap-1"><span className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-medium">{team.name}</span><Badge variant="outline">{team.key}</Badge></span><span className="truncate text-xs text-muted-foreground">{team.description || 'No description added.'}</span><span className="flex gap-3 text-xs text-muted-foreground sm:hidden"><span>{team.memberCount ?? team.members?.length ?? 0} members</span><span>{team.issueCount ?? 0} issues</span></span></span>
              <span className="flex shrink-0 items-center gap-6 text-xs tabular-nums text-muted-foreground"><span className="hidden items-center gap-2 sm:flex"><Users className="size-3.5" />{team.memberCount ?? team.members?.length ?? 0} members</span><span className="hidden items-center gap-2 sm:flex"><CheckSquare className="size-3.5" />{team.issueCount ?? 0} issues</span><ChevronRight className="size-4" /></span>
            </Link>
          </li>)}
        </ul>
      ) : <div className="flex flex-col items-center gap-2 py-16"><p className="text-sm font-medium">No teams yet</p><p className="text-sm text-muted-foreground">Create a team to organize its issues and members.</p></div>}
      {canCreateTeam && <CreateTeamDialog open={isCreateOpen} onOpenChange={open => { setIsCreateOpen(open); if (!open && location.search) navigate('/teams', { replace: true }); }} />}
    </div>
  );
}
