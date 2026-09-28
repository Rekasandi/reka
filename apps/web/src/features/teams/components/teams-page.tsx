import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Skeleton,
} from '@reka/ui';
import { Plus, Users, Hash, CheckSquare, Trash2, RefreshCw } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTeams, useDeleteTeam } from '../hooks/use-teams';
import { CreateTeamDialog } from './create-team-dialog';

export function TeamsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = React.useState(
    new URLSearchParams(location.search).get('create') === '1',
  );

  React.useEffect(() => {
    setIsCreateOpen(new URLSearchParams(location.search).get('create') === '1');
  }, [location.search]);
  const { data: teams = [], isLoading, isError, refetch } = useTeams();

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Teams</h1>
            <span className="font-mono text-xs font-medium text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {teams.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Collaborative groups owning separate issue identifiers, cycles, and roadmaps.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsCreateOpen(true)} className="rounded-[6px] h-8 px-3 text-xs font-medium">
          <Plus data-icon="inline-start" className="size-3.5" />
          <span>New Team</span>
        </Button>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load teams from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Teams Grid */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <Card
              key={t.id}
              onClick={() => navigate(`/teams/${t.id}`)}
              className="rounded-lg border border-border bg-card hover:border-foreground/25 transition-colors flex flex-col justify-between group cursor-pointer shadow-none"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-foreground border border-border shrink-0">
                      {t.key}
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">
                        {t.name}
                      </CardTitle>
                    </div>
                  </div>
                </div>

                <CardDescription className="text-xs line-clamp-2 text-muted-foreground leading-relaxed mt-2">
                  {t.description || 'No team charter or description specified.'}
                </CardDescription>
              </CardHeader>

              <CardFooter className="p-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground font-mono">
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted-foreground/70" />
                  <span className="text-xs">{t.memberCount || 1} members</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <CheckSquare className="size-3.5 text-muted-foreground/70" />
                  <span className="text-xs">{t.issueCount || 0} issues</span>
                </div>
              </CardFooter>
            </Card>
          ))}

          {teams.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10">
              No teams created yet. Click &ldquo;New Team&rdquo; to establish your first workspace team.
            </div>
          )}
        </div>
      )}

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open && location.search) navigate('/teams', { replace: true });
        }}
      />
    </div>
  );
}
