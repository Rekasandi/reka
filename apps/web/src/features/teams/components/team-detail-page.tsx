import * as React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Avatar,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  AvatarFallback,
} from '@reka/ui';
import {
  ArrowLeft,
  Plus,
  Users,
  CheckSquare,
  Repeat,
  Trash2,
  RefreshCw,
  UserPlus,
  Shield,
  FolderKanban,
  ArrowRight,
} from 'lucide-react';
import { useTeam, useDeleteTeam, useRemoveTeamMember } from '../hooks/use-teams';
import { useIssues, useUpdateIssue } from '../../issues/hooks/use-issues';
import { useProjects } from '../../projects/hooks/use-projects';
import { useCycles } from '../../cycles/hooks/use-cycles';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { AddMemberDialog } from './add-member-dialog';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import type { Issue } from '@reka/types';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = new URLSearchParams(location.search).get('tab');

  const [activeTab, setActiveTab] = React.useState(tab === 'members' ? tab : 'home');

  React.useEffect(() => {
    setActiveTab(tab === 'members' ? tab : 'home');
  }, [tab]);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = React.useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isIssueDetailOpen, setIsIssueDetailOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const { data: team, isLoading, isError, refetch } = useTeam(id);
  const { data: allIssues = [] } = useIssues();
  const { data: projects = [] } = useProjects();
  const { data: cycles = [] } = useCycles();
  const updateIssueMutation = useUpdateIssue();
  const deleteMutation = useDeleteTeam();
  const removeMemberMutation = useRemoveTeamMember(id || '');

  // Issues belonging to this team
  const teamIssues = React.useMemo(() => {
    return allIssues.filter((i) => i.teamId === id);
  }, [allIssues, id]);

  const teamProjects = React.useMemo(
    () => projects.filter((project) => project.teamId === id),
    [projects, id],
  );
  const teamCycles = React.useMemo(
    () => cycles.filter((cycle) => cycle.teamId === id),
    [cycles, id],
  );
  const activeCycle = teamCycles.find((cycle) => cycle.status === 'active');
  const planningCycle = activeCycle ?? teamCycles.find((cycle) => cycle.status === 'upcoming');
  const backlogIssues = teamIssues.filter((issue) =>
    !issue.cycleId && issue.status !== 'done' && issue.status !== 'canceled',
  );
  const cycleIssues = activeCycle
    ? teamIssues.filter((issue) => issue.cycleId === activeCycle.id)
    : [];
  const doneCycleIssues = cycleIssues.filter((issue) => issue.status === 'done').length;
  const cycleProgress = cycleIssues.length ? Math.round((doneCycleIssues / cycleIssues.length) * 100) : 0;

  const handleDelete = () => {
    if (!team) return;
    setIsDeleteDialogOpen(true);
  };

  const handleOpenIssueDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsIssueDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-40 rounded-[6px]" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-xs text-destructive flex items-center justify-between max-w-3xl mx-auto">
        <span>Failed to load team details.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
          <RefreshCw data-icon="inline-start" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/teams"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Teams</span>
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleDelete}
          className="text-muted-foreground/50 hover:text-destructive"
          title="Delete team"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Team Header Spotlight */}
      <div className="rounded-lg border border-border/80 bg-card/40 p-6 flex flex-col gap-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center text-foreground font-mono font-bold text-sm shrink-0 border border-border/70 shadow-2xs">
              {team.key}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {team.name}
                </h1>
                <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 border-border/70 bg-background/60">
                  {team.key}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Issues identifier prefix: <span className="font-mono font-medium text-foreground">{team.key}-1</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddMemberOpen(true)}
              className="h-8 text-xs rounded-[6px]"
            >
              <UserPlus data-icon="inline-start" className="size-3.5" />
              <span>Add Member</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateIssueOpen(true)}
              className="h-8 text-xs rounded-[6px]"
            >
              <Plus data-icon="inline-start" className="size-3.5" />
              <span>New Team Issue</span>
            </Button>
          </div>
        </div>

        {team.description && (
          <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
            {team.description}
          </p>
        )}

        {/* Stats strip */}
        <div className="flex items-center gap-6 pt-3 border-t border-border/50 text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="size-3.5 text-muted-foreground/70" />
            <span>{team.members?.length || 1} members</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckSquare className="size-3.5 text-muted-foreground/70" />
            <span>{teamIssues.length} issues tracked</span>
          </div>
        </div>
      </div>

      {/* Tabs Section: Issues & Members */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-col gap-4 w-full">
        <TabsList variant="line" className="h-9 w-fit justify-start gap-6 p-0 border-b border-border/60 pb-1">
          <TabsTrigger
            value="home"
            className="h-8 flex-none rounded-none border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground"
          >
            <Repeat className="size-3.5" />
            <span>Home</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="h-8 flex-none rounded-none border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground"
          >
            <Users className="size-3.5" />
            <span>Members ({team.members?.length || 1})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-0 w-full space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section className="lg:col-span-7 rounded-lg border border-border/80 bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Repeat className="size-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-semibold text-foreground">{activeCycle ? 'Active cycle' : 'Cycle planning'}</h2>
                </div>
                {planningCycle ? (
                  <Link to={`/cycles/${planningCycle.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    Open cycle <ArrowRight className="size-3" />
                  </Link>
                ) : (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => navigate('/cycles')}>
                    Create cycle
                  </Button>
                )}
              </div>
              <div className="p-4">
                {planningCycle ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">{planningCycle.name || `Cycle ${planningCycle.number}`}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {activeCycle ? `${doneCycleIssues} of ${cycleIssues.length} issues completed` : 'Upcoming cycle ready for planning'}
                        </p>
                      </div>
                      {activeCycle && <span className="font-mono text-xs font-semibold text-foreground">{cycleProgress}%</span>}
                    </div>
                    {activeCycle && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${cycleProgress}%` }} />
                      </div>
                    )}
                    <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
                      <Select
                        onValueChange={(issueId) => updateIssueMutation.mutate({
                          id: issueId,
                          data: { cycleId: planningCycle.id },
                        })}
                      >
                        <SelectTrigger disabled={!backlogIssues.length} className="h-8 flex-1 rounded-[6px] text-xs">
                          <SelectValue placeholder={backlogIssues.length ? 'Plan backlog issue…' : 'No backlog issues'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {backlogIssues.map((issue) => (
                              <SelectItem key={issue.id} value={issue.id}>{issue.identifier} · {issue.title}</SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground sm:w-36">Add work to this cycle.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-32 flex-col items-start justify-center gap-2">
                    <p className="text-sm font-medium text-foreground">No cycle ready for planning</p>
                    <p className="text-xs text-muted-foreground">Create a cycle, then plan backlog issues here.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="lg:col-span-5 rounded-lg border border-border/80 bg-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FolderKanban className="size-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-semibold text-foreground">Projects</h2>
                </div>
                <Link to={`/projects?teamId=${team.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">View all</Link>
              </div>
              <div className="divide-y divide-border/60">
                {teamProjects.slice(0, 4).map((project) => (
                  <Link key={project.id} to={`/projects/${project.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-xs hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{project.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground capitalize">{project.status.replace('_', ' ')}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{project.progress ?? 0}%</span>
                  </Link>
                ))}
                {!teamProjects.length && <div className="p-6 text-xs text-muted-foreground">No projects linked to this team.</div>}
              </div>
            </section>
          </div>

          <section className="rounded-lg border border-border/80 bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-3.5 text-muted-foreground" />
                <h2 className="text-xs font-semibold text-foreground">Backlog</h2>
                <span className="font-mono text-xs text-muted-foreground">{backlogIssues.length}</span>
              </div>
              <Link to={`/teams/${team.id}/issues`} className="text-xs font-medium text-muted-foreground hover:text-foreground">View issues</Link>
            </div>
            <div className="divide-y divide-border/60">
              {backlogIssues.slice(0, 5).map((issue) => (
                <button key={issue.id} type="button" onClick={() => handleOpenIssueDetail(issue)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs hover:bg-muted/30">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{issue.identifier}</span>
                    <span className="truncate font-medium text-foreground">{issue.title}</span>
                  </div>
                  <span className="hidden shrink-0 text-xs capitalize text-muted-foreground sm:block">{issue.status.replace('_', ' ')}</span>
                </button>
              ))}
              {!backlogIssues.length && <div className="p-6 text-xs text-muted-foreground">Team backlog is clear.</div>}
            </div>
          </section>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-0 w-full">
          <div className="rounded-lg border border-border/80 divide-y divide-border/60 bg-card/30 overflow-hidden">
            {(team.members || []).map((m) => {
              const userName = m.user?.name || 'Gustam';
              const userEmail = m.user?.email || 'owner@rekasandi.com';
              const initial = userName[0] || 'U';

              return (
                <div key={m.userId} className="flex items-center justify-between p-3.5 text-xs hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-7 rounded-full border border-border/70">
                      <AvatarFallback className="text-xs font-medium bg-secondary text-foreground">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground text-xs">{userName}</span>
                      <span className="text-xs font-mono text-muted-foreground">{userEmail}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={m.role === 'lead' ? 'default' : 'secondary'} className="capitalize text-xs h-5 px-2">
                      {m.role === 'lead' && <Shield className="size-2.5 mr-1" />}
                      <span>{m.role}</span>
                    </Badge>

                    {m.role !== 'lead' && (
                      <button
                        type="button"
                        onClick={() => removeMemberMutation.mutate(m.userId)}
                        className="text-muted-foreground/30 hover:text-destructive p-1 rounded transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {(!team.members || team.members.length === 0) && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No members found in this team.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <AddMemberDialog
        teamId={team.id}
        open={isAddMemberOpen}
        onOpenChange={setIsAddMemberOpen}
        existingMemberUserIds={team.members?.map((m) => m.userId) || []}
      />

      {/* Create Issue Dialog pre-configured for this team */}
      <CreateIssueDialog
        open={isCreateIssueOpen}
        onOpenChange={setIsCreateIssueOpen}
        defaultTeamId={team.id}
      />

      {/* Detail Sheet for issues */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isIssueDetailOpen}
        onOpenChange={setIsIssueDetailOpen}
      />

      {/* Delete Confirmation Alert Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Delete team "${team.name}"?`}
        description="This will permanently delete this team and remove all member associations."
        onConfirm={() => {
          deleteMutation.mutate(team.id, {
            onSuccess: () => navigate('/teams'),
          });
        }}
      />
    </div>
  );
}
