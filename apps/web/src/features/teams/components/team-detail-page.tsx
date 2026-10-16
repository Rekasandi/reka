import * as React from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reka/ui';
import {
  Plus,
  Users,
  CheckSquare,
  Repeat,
  Trash2,
  RefreshCw,
  LockKeyhole,
  FolderKanban,
  ArrowRight,
} from 'lucide-react';
import { useTeam, useDeleteTeam, useJoinTeam } from '../hooks/use-teams';
import { useIssues, useUpdateIssue } from '../../issues/hooks/use-issues';
import { useProjects } from '../../projects/hooks/use-projects';
import { useCycles } from '../../cycles/hooks/use-cycles';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { TeamSettingsForm } from './team-settings-dialog';
import { TeamMembersPanel } from './team-members-panel';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { getIssueStatusCategory, isIssueClosed, type Issue } from '@reka/types';
import { resolveEntityIcon } from '../../../components/entity-icon-picker';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = new URLSearchParams(location.search).get('tab');

  const activeTab = tab === 'members' || tab === 'settings' ? tab : 'home';
  const setActiveTab = (value: string) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(location.search);
    if (value === 'home') params.delete('tab'); else params.set('tab', value);
    navigate({ pathname: location.pathname, search: params.toString() });
  };
  const [isCreateIssueOpen, setIsCreateIssueOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isIssueDetailOpen, setIsIssueDetailOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [settingsPending, setSettingsPending] = React.useState(false);

  const { data: team, isLoading, isError, refetch } = useTeam(id);
  const { data: allIssues = [] } = useIssues();
  const { data: projects = [] } = useProjects();
  const { data: cycles = [] } = useCycles();
  const updateIssueMutation = useUpdateIssue();
  const deleteMutation = useDeleteTeam();
  const joinMutation = useJoinTeam(id || '');

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
    !issue.cycleId && !isIssueClosed(issue),
  );
  const cycleIssues = activeCycle
    ? teamIssues.filter((issue) => issue.cycleId === activeCycle.id)
    : [];
  const doneCycleIssues = cycleIssues.filter((issue) => getIssueStatusCategory(issue) === 'completed').length;
  const cycleProgress = cycleIssues.length ? Math.round((doneCycleIssues / cycleIssues.length) * 100) : 0;

  const handleOpenIssueDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsIssueDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-none mx-auto">
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

  const TeamIcon = resolveEntityIcon(team.icon ?? 'Users');
  const memberCount = team.members?.length ?? team.memberCount ?? 0;

  return (
    <div className="team-detail-page flex min-w-0 flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[6px] border border-border bg-secondary text-muted-foreground"><TeamIcon className="size-5" /></span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="min-w-0 break-words text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">{team.name}</h1>{team.isPrivate && <Badge variant="outline"><LockKeyhole data-icon="inline-start" />Private</Badge>}</div>{team.description && <p className="mt-1 max-w-3xl break-words text-sm text-muted-foreground">{team.description}</p>}</div>
          </div>
          {(team.canJoin || (team.canWrite && activeTab === 'home')) && <div className="flex flex-wrap items-center gap-2">
            {team.canJoin && <Button variant="outline" size="sm" disabled={joinMutation.isPending} onClick={() => joinMutation.mutate()}>{joinMutation.isPending ? 'Joining…' : 'Join team'}</Button>}
            {team.canWrite && activeTab === 'home' && <Button size="sm" onClick={() => setIsCreateIssueOpen(true)}><Plus data-icon="inline-start" /><span>New Team Issue</span></Button>}
          </div>}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Users aria-hidden="true" className="size-3.5" />{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          <span className="inline-flex items-center gap-1.5"><CheckSquare aria-hidden="true" className="size-3.5" />{teamIssues.length} {teamIssues.length === 1 ? 'issue' : 'issues'} tracked</span>
          <span>Issue prefix <span className="font-mono text-foreground">{team.key}</span></span>
        </div>
      </header>

      {/* Tabs Section: Issues & Members */}
      <Tabs value={activeTab} onValueChange={setActiveTab} activationMode="manual" className="team-detail-tabs min-w-0 w-full flex-col gap-6">
        <TabsList aria-label="Team sections" variant="line" className="w-full justify-start gap-6 rounded-none border-b border-border p-0">
          <TabsTrigger
            value="home"
            className="h-10 flex-none rounded-none border-0 px-0"
          >
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="h-10 flex-none rounded-none border-0 px-0"
          >
            <span>Members</span>
          </TabsTrigger>
          {team.canManage && <TabsTrigger value="settings" className="h-10 flex-none rounded-none border-0 px-0">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="home" className="mt-0 flex w-full flex-col gap-5">
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
                  <Button variant="ghost" size="xs" className="px-1.5" onClick={() => navigate('/cycles')}>
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
                        <SelectTrigger size="compact" disabled={!team.canWrite || !backlogIssues.length} className="flex-1">
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
          <TeamMembersPanel key={team.id} team={team} />
        </TabsContent>
        <TabsContent value="settings" className="mt-0 flex w-full max-w-4xl flex-col gap-8">
          {team.canManage ? <><section className="flex min-w-0 flex-col gap-6"><div><h2 className="text-xl font-semibold tracking-[-0.02em]">Team settings</h2><p className="mt-1 text-xs text-muted-foreground">Manage team access and issue workflow.</p></div><TeamSettingsForm team={team} onPendingChange={setSettingsPending} /></section>{team.canDelete && <section className="flex flex-col items-start gap-3 border-t border-border pt-6"><h2 className="text-sm font-semibold">Delete team</h2><p className="max-w-prose text-sm text-muted-foreground">Permanently deletes this team and its issues. This action cannot be undone.</p><Button variant="destructive" disabled={settingsPending || deleteMutation.isPending} onClick={() => setIsDeleteDialogOpen(true)}><Trash2 data-icon="inline-start" />Delete team</Button></section>}</> : <p className="text-sm text-muted-foreground">Only team managers can change these settings.</p>}
        </TabsContent>
      </Tabs>

      {/* Create Issue Dialog pre-configured for this team */}
      {team.canWrite && <CreateIssueDialog
        open={isCreateIssueOpen}
        onOpenChange={setIsCreateIssueOpen}
        defaultTeamId={team.id}
      />}

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
        description="This permanently deletes this team, its issues and member associations. This action cannot be undone."
        onConfirm={() => {
          deleteMutation.mutate(team.id, {
            onSuccess: () => navigate('/teams'),
          });
        }}
      />
    </div>
  );
}
