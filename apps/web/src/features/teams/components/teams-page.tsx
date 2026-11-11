import * as React from 'react';
import { Badge, Button, Skeleton, Alert, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Avatar, AvatarFallback, AvatarImage } from '@reka/ui';
import { Plus, Users, Check, Box, RefreshCw } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTeams } from '../hooks/use-teams';
import { CreateTeamDialog } from './create-team-dialog';
import { useAuth } from '../../auth/hooks/use-auth';
import { EmptyState, PageContainer, PageHeader } from '../../../components/common/page';

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
    <PageContainer>
      <PageHeader title="Teams" count={teams.length} description="Teams, members, and the work they own."
        actions={canCreateTeam && <Button onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />New team</Button>} />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Spinner aria-label="Loading teams" className="sr-only" />
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
        </div>
      ) : isError ? (
        <Alert variant="destructive" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">Could not load teams.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button>
        </Alert>
      ) : teams.length ? (
        <Table aria-label="Teams" className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-72">
                  Name
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Membership</TableHead>
                <TableHead className="w-28">Members</TableHead>
                <TableHead className="w-32 text-right">Active projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map(team => {
                const isMember = Boolean(team.currentMemberRole || (user && team.members?.some(m => m.userId === user.id)));
                const activeProjectsCount = team.activeProjectCount ?? 0;
                const membersList = team.members ?? [];

                return (
                  <TableRow key={team.id}>
                    {/* Name column */}
                    <TableCell>
                      <Link
                        to={`/teams/${team.id}`}
                        aria-label={`Open team ${team.name}`}
                        className="inline-flex max-w-full items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-border bg-muted/60 font-mono text-2xs font-semibold text-muted-foreground">
                          {team.key}
                        </span>
                        <span className="truncate font-medium text-foreground hover:underline">
                          {team.name}
                        </span>
                      </Link>
                    </TableCell>

                    {/* Description column */}
                    <TableCell className="text-muted-foreground">
                      <span className="block truncate" title={team.description || undefined}>
                        {team.description || 'No description'}
                      </span>
                    </TableCell>

                    {/* Membership column */}
                    <TableCell>
                      {isMember ? (
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 py-0 text-xs gap-1 font-normal border-border/80 bg-muted/40 text-foreground whitespace-nowrap"
                        >
                          <Check className="size-3 text-muted-foreground" />
                          <span>Joined</span>
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Not a member</span>
                      )}
                    </TableCell>

                    {/* Members column with avatar stack */}
                    <TableCell>
                      <div className="flex items-center -space-x-1.5">
                        {membersList.slice(0, 3).map((m) => {
                          const displayName = m.user?.name?.trim() || m.user?.email?.split('@')[0] || '';
                          const initial = (displayName[0] || 'U').toUpperCase();
                          return (
                            <Avatar
                              key={m.userId}
                              className="size-5 rounded-full border border-background ring-1 ring-border shrink-0"
                            >
                              {m.user?.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt={displayName} />}
                              <AvatarFallback className="text-2xs font-bold bg-secondary text-foreground">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                          );
                        })}
                        {membersList.length === 0 && (
                          <Users className="size-4 text-muted-foreground/50" />
                        )}
                        {membersList.length > 3 && (
                          <span className="text-xs text-muted-foreground pl-2 font-mono">
                            +{membersList.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Active projects column */}
                    <TableCell className="text-right">
                      <span className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                        <Box className="size-3.5 text-muted-foreground" />
                        <span>{activeProjectsCount}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      ) : (
        <EmptyState icon={Users} title="No teams yet" description="Create a team to organize its issues and members."
          action={canCreateTeam && <Button variant="outline" onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />New team</Button>} />
      )}

      {canCreateTeam && <CreateTeamDialog open={isCreateOpen} onOpenChange={open => { setIsCreateOpen(open); if (!open && location.search) navigate('/teams', { replace: true }); }} />}
    </PageContainer>
  );
}
