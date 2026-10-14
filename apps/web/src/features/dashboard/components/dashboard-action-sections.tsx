import * as React from 'react';
import { Badge, Button, Card, CardContent, Skeleton } from '@reka/ui';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format, formatDistanceToNow } from 'date-fns';
import { getIssueStatusCategory, type Issue } from '@reka/types';
import { useIssues } from '../../issues/hooks/use-issues';
import { useProjects } from '../../projects/hooks/use-projects';
import { useCycles } from '../../cycles/hooks/use-cycles';
import { useTeams } from '../../teams/hooks/use-teams';
import { useIssuePullRequests } from '../../issues/hooks/use-github-integration';
import { attentionReasons, upcomingTargets, workDate } from '../lib/dashboard-work';

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return <Card className="min-w-0 gap-0 py-0">
    <section aria-label={title}>
      <header className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
      </header>
      <CardContent className="p-2">{children}</CardContent>
    </section>
  </Card>;
}

function QueryContent({ loading, error, retry, children }: { loading: boolean; error: boolean; retry: () => void; children: React.ReactNode }) {
  if (loading) return <div role="status" aria-label="Loading dashboard work" className="flex flex-col gap-2 py-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  if (error) return <div role="alert" className="flex flex-wrap items-center gap-3 py-4"><p className="text-sm text-muted-foreground">Could not load this section.</p><Button variant="outline" size="sm" onClick={retry}>Retry</Button></div>;
  return <>{children}</>;
}

function IssueButton({ issue, onSelect, children }: { issue: Issue; onSelect: (issue: Issue) => void; children?: React.ReactNode }) {
  return <button type="button" aria-label={`Open issue ${issue.identifier}: ${issue.title}`} onClick={() => onSelect(issue)}
    className="flex w-full min-w-0 flex-col items-start gap-2 rounded-md px-2 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between">
    <span className="flex w-full min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">{issue.identifier}</span>
      <span className="truncate text-sm font-medium" title={issue.title}>{issue.title}</span>
    </span>
    {children && <span className="flex max-w-full shrink-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">{children}</span>}
  </button>;
}

function More({ total, expanded, onToggle }: { total: number; expanded: boolean; onToggle: () => void }) {
  return total > 6 ? <Button variant="ghost" size="sm" className="mt-2" onClick={onToggle}>{expanded ? 'Show less' : `Show all ${total}`}</Button> : null;
}

function ReviewIssue({ issue, onSelect }: { issue: Issue; onSelect: (issue: Issue) => void }) {
  const { data: prs = [], isPending, isError, refetch } = useIssuePullRequests(issue.id);
  const updated = workDate(issue.updatedAt);
  return <li className="py-1">
    <IssueButton issue={issue} onSelect={onSelect}>{updated && `Updated ${formatDistanceToNow(updated, { addSuffix: true })}`}</IssueButton>
    <div className="flex min-w-0 flex-col gap-2 px-2 pb-3 text-xs text-muted-foreground">
      {isPending ? <Skeleton className="h-5 w-48 max-w-full" /> : isError ? <div role="alert" className="flex flex-wrap items-center gap-2">Pull requests unavailable.<Button variant="outline" size="xs" onClick={() => { void refetch(); }}>Retry PRs</Button></div> : prs.length ? prs.map(pr => (
        <a key={pr.id} href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open pull request #${pr.prNumber}: ${pr.title}`}>
          <span className="shrink-0">#{pr.prNumber}</span><span className="truncate">{pr.title}</span><span className="shrink-0">{pr.merged ? 'Merged' : pr.state === 'closed' ? 'Closed' : 'Open'}</span>
        </a>
      )) : <span>No pull request linked.</span>}
    </div>
  </li>;
}

export function DashboardActionSections({ onSelectIssue }: { onSelectIssue: (issue: Issue) => void }) {
  const issueQuery = useIssues();
  const projectQuery = useProjects();
  const cycleQuery = useCycles();
  const teamQuery = useTeams();
  const issues = issueQuery.data ?? [];
  const projects = projectQuery.data ?? [];
  const now = new Date();
  const attention = issues.filter(issue => attentionReasons(issue, now).length).sort((a, b) =>
    Number(b.status === 'blocked') - Number(a.status === 'blocked') ||
    (workDate(a.dueDate)?.getTime() ?? Infinity) - (workDate(b.dueDate)?.getTime() ?? Infinity));
  const targets = upcomingTargets(issues, projects, now);
  const reviews = issues.filter(issue => issue.status === 'in_review').sort((a, b) =>
    (workDate(a.updatedAt)?.getTime() ?? Infinity) - (workDate(b.updatedAt)?.getTime() ?? Infinity));
  const activeCycles = (cycleQuery.data ?? []).filter(cycle => cycle.status === 'active').sort((a, b) => a.teamId.localeCompare(b.teamId) || a.startDate.localeCompare(b.startDate));
  const [allAttention, setAllAttention] = React.useState(false);
  const [allTargets, setAllTargets] = React.useState(false);
  const [allReviews, setAllReviews] = React.useState(false);
  const countsAvailable = !issueQuery.isLoading && !issueQuery.isError;

  return <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-7 xl:grid-cols-2">
    <Section title="Needs attention" count={countsAvailable ? attention.length : undefined}>
      <QueryContent loading={issueQuery.isLoading} error={issueQuery.isError} retry={() => { void issueQuery.refetch(); }}>
        {attention.length ? <>
          <ul className="divide-y divide-border/50">{attention.slice(0, allAttention ? undefined : 6).map(issue => <li key={issue.id}><IssueButton issue={issue} onSelect={onSelectIssue}>{attentionReasons(issue, now).map(reason => <Badge key={reason} variant={reason === 'Overdue' || reason === 'Blocked' ? 'destructive' : 'outline'}>{reason}</Badge>)}</IssueButton></li>)}</ul>
          <More total={attention.length} expanded={allAttention} onToggle={() => setAllAttention(!allAttention)} />
        </> : <p className="py-4 text-sm text-muted-foreground">No blocked, overdue, unassigned, or urgent issues.</p>}
      </QueryContent>
    </Section>

    <Section title="Upcoming targets" count={countsAvailable && !projectQuery.isLoading && !projectQuery.isError ? targets.length : undefined}>
      <p className="mb-2 text-xs text-muted-foreground">Today and the next 7 days, earliest first.</p>
      <QueryContent loading={issueQuery.isLoading || projectQuery.isLoading} error={issueQuery.isError || projectQuery.isError} retry={() => { void issueQuery.refetch(); void projectQuery.refetch(); }}>
        {targets.length ? <>
          <ul className="divide-y divide-border/50">{targets.slice(0, allTargets ? undefined : 6).map(target => <li key={`${target.kind}-${target.kind === 'issue' ? target.issue.id : target.project.id}`}>
            {target.kind === 'issue' ? <IssueButton issue={target.issue} onSelect={onSelectIssue}><span>Issue</span><time dateTime={target.date.toISOString()}>{format(target.date, 'MMM d')}</time></IssueButton> :
              <Link to={`/projects/${target.project.id}`} aria-label={`Open project ${target.project.name}`} className="flex min-w-0 flex-col items-start gap-2 rounded-md px-2 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 truncate text-sm font-medium" title={target.project.name}>{target.project.name}</span><span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">Project<time dateTime={target.date.toISOString()}>{format(target.date, 'MMM d')}</time></span>
              </Link>}
          </li>)}</ul>
          <More total={targets.length} expanded={allTargets} onToggle={() => setAllTargets(!allTargets)} />
        </> : <p className="py-4 text-sm text-muted-foreground">No issue or project deadlines in the next 7 days.</p>}
      </QueryContent>
    </Section>

    <Section title="Active cycles" count={!cycleQuery.isLoading && !cycleQuery.isError ? activeCycles.length : undefined}>
      <QueryContent loading={cycleQuery.isLoading} error={cycleQuery.isError} retry={() => { void cycleQuery.refetch(); }}>
        {teamQuery.isError && <p role="alert" className="flex flex-wrap items-center gap-2 py-2 text-xs text-muted-foreground">Team names unavailable.<Button variant="outline" size="xs" onClick={() => { void teamQuery.refetch(); }}>Retry teams</Button></p>}
        {activeCycles.length ? <ul className="divide-y divide-border/50">{activeCycles.map(cycle => {
          const team = teamQuery.data?.find(item => item.id === cycle.teamId);
          const cycleIssues = issues.filter(issue => issue.cycleId === cycle.id && issue.status !== 'canceled');
          const done = cycleIssues.filter(issue => getIssueStatusCategory(issue) === 'completed').length;
          const remaining = cycleIssues.length - done;
          const end = workDate(cycle.endDate);
          const days = end ? differenceInCalendarDays(end, now) : null;
          const timeLeft = days === null ? 'End date unavailable' : days < 0 ? 'Schedule ended' : days === 0 ? 'Ends today' : `${days} ${days === 1 ? 'day' : 'days'} left`;
          return <li key={cycle.id}>
            <Link to={`/cycles/${cycle.id}`} className="flex min-w-0 flex-col gap-2 rounded-md px-2 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open cycle ${cycle.name || `Cycle ${cycle.number}`}`}>
              <span className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0 truncate text-sm font-medium">{cycle.name || `Cycle ${cycle.number}`}</span><span className="shrink-0 text-xs text-muted-foreground">{timeLeft}</span></span>
              <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{team?.name ?? (teamQuery.isLoading ? 'Loading team…' : 'Team unavailable')}</span><span>{!countsAvailable ? issueQuery.isLoading ? 'Loading issue counts…' : 'Issue counts unavailable' : `${remaining} remaining, ${done} of ${cycleIssues.length} completed`}</span></span>
            </Link>
          </li>;
        })}</ul> : <p className="py-4 text-sm text-muted-foreground">No active cycles. <Link to="/cycles" className="text-foreground underline underline-offset-4">View cycles</Link> to plan the next one.</p>}
      </QueryContent>
    </Section>

    <Section title="Waiting for review" count={countsAvailable ? reviews.length : undefined}>
      <QueryContent loading={issueQuery.isLoading} error={issueQuery.isError} retry={() => { void issueQuery.refetch(); }}>
        {reviews.length ? <>
          <ul className="divide-y divide-border/50">{reviews.slice(0, allReviews ? undefined : 6).map(issue => <ReviewIssue key={issue.id} issue={issue} onSelect={onSelectIssue} />)}</ul>
          <More total={reviews.length} expanded={allReviews} onToggle={() => setAllReviews(!allReviews)} />
        </> : <p className="py-4 text-sm text-muted-foreground">No issues waiting for review.</p>}
      </QueryContent>
    </Section>
  </div>;
}
