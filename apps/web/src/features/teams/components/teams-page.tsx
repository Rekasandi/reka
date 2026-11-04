import * as React from 'react';
import { Badge, Button, Skeleton, Alert, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Avatar, AvatarFallback, AvatarImage } from '@reka/ui';
import { Plus, Users, Check, Box, RefreshCw, ArrowDown } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTeams } from '../hooks/use-teams';
import { CreateTeamDialog } from './create-team-dialog';
import { useAuth } from '../../auth/hooks/use-auth';

export function TeamsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = React.useState(new URLSearchParams(location.search).get('create') === '1');
  React.useEffect(() => { setIsCreateOpen(new URLSearchParams(location.search).get('create') === '1'); }, [location.search]);
  const { data: teams = [], isLoading, isError, refetch } = useTeams();
  const { user } = useAuth();
  const role = user?.role;
  const canCreateTeam = role === 'owner' || role === 'admin' || role === 'member';

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Teams</h1>
            <Badge variant="outline">{teams.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Teams, members, and the work they own.</p>
        </div>
        {canCreateTeam && <Button onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />Create team</Button>}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Spinner aria-label="Loading teams" className="sr-only" />
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
        </div>
      ) : isError ? (
        <Alert className="rounded-none border-0 bg-transparent px-0 py-0 text-foreground flex flex-wrap items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground">Could not load teams.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
        </Alert>
      ) : teams.length ? (
        <div className="overflow-x-auto">
          <Table aria-label="Teams" className="w-full text-xs">
            <TableHeader className="text-muted-foreground border-0 [&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className="w-[32%] py-3 font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    Name <ArrowDown className="size-3 text-muted-foreground" />
                  </span>
                </TableHead>
                <TableHead className="w-[32%] py-3 font-medium text-muted-foreground">Description</TableHead>
                <TableHead className="w-[12%] py-3 font-medium text-muted-foreground">Membership</TableHead>
                <TableHead className="w-[12%] py-3 font-medium text-muted-foreground">Members</TableHead>
                <TableHead className="w-[12%] py-3 text-right font-medium text-muted-foreground">Active projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="border-0 [&_tr]:border-0">
              {teams.map(team => {
                const isMember = Boolean(team.currentMemberRole || (user && team.members?.some(m => m.userId === user.id)));
                const activeProjectsCount = team.activeProjectCount ?? 0;
                const membersList = team.members ?? [];

                return (
                  <TableRow key={team.id} className="h-14 border-0 hover:bg-muted/30 transition-colors">
                    {/* Name column */}
                    <TableCell className="py-2.5">
                      <Link
                        to={`/teams/${team.id}`}
                        aria-label={`Open team ${team.name}`}
                        className="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted/60 font-mono text-[9px] font-semibold text-muted-foreground">
                          {team.key}
                        </span>
                        <span className="font-medium text-sm text-foreground hover:underline truncate max-w-[200px] sm:max-w-xs">
                          {team.name}
                        </span>
                      </Link>
                    </TableCell>

                    {/* Description column */}
                    <TableCell className="py-2.5 text-muted-foreground">
                      <span className="block truncate max-w-sm text-xs" title={team.description || undefined}>
                        {team.description || '—'}
                      </span>
                    </TableCell>

                    {/* Membership column */}
                    <TableCell className="py-2.5">
                      {isMember ? (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 py-0 text-[11px] gap-1 font-normal border-border/80 bg-muted/40 text-foreground whitespace-nowrap"
                        >
                          <Check className="size-3 text-muted-foreground" />
                          <span>Joined</span>
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Members column with avatar stack */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center -space-x-1.5">
                        {membersList.slice(0, 3).map((m) => {
                          const initial = (m.user?.name?.[0] || 'U').toUpperCase();
                          return (
                            <Avatar
                              key={m.userId}
                              className="size-5 rounded-full border border-background ring-1 ring-border shrink-0"
                            >
                              {m.user?.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt={m.user.name} />}
                              <AvatarFallback className="text-[9px] font-bold bg-secondary text-foreground">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                          );
                        })}
                        {membersList.length === 0 && (
                          <Users className="size-4 text-muted-foreground/50" />
                        )}
                        {membersList.length > 3 && (
                          <span className="text-[10px] text-muted-foreground pl-2 font-mono">
                            +{membersList.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Active projects column */}
                    <TableCell className="py-2.5 text-right">
                      <span className="inline-flex items-center justify-end gap-1.5 font-mono text-xs tabular-nums text-foreground">
                        <Box className="size-3.5 text-muted-foreground" />
                        <span>{activeProjectsCount}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-16">
          <p className="text-sm font-medium">No teams yet</p>
          <p className="text-sm text-muted-foreground">Create a team to organize its issues and members.</p>
        </div>
      )}

      {canCreateTeam && <CreateTeamDialog open={isCreateOpen} onOpenChange={open => { setIsCreateOpen(open); if (!open && location.search) navigate('/teams', { replace: true }); }} />}
    </div>
  );
}
