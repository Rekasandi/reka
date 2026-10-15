import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, Button, Skeleton } from '@reka/ui';
import { ArrowUpRight } from 'lucide-react';
import { useTeams } from '../../teams/hooks/use-teams';
import { TeamSettingsDialog } from '../../teams/components/team-settings-dialog';
import { ManageLabelsDialog } from '../../issues/components/manage-labels-dialog';
import { useProjects } from '../../projects/hooks/use-projects';
import type { Team } from '../../teams/api/teams.api';

export function IssueSettings({ labels = false }: { labels?: boolean }) {
  const query = useTeams();
  const [selectedTeam, setSelectedTeam] = React.useState<Team | null>(null);
  const [labelsOpen, setLabelsOpen] = React.useState(false);
  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError) return <Alert variant="destructive"><AlertDescription>Could not load teams. <Button variant="link" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert>;
  return <div className="flex flex-col gap-4">
    <p className="text-sm text-muted-foreground">{labels ? 'Labels are scoped to teams and projects. Team managers can create, rename and remove labels.' : 'Issue workflows belong to teams. Team managers can change status names, categories, colors and order.'}</p>
    {!query.data.length && <p className="text-sm text-muted-foreground">No teams are available to your account.</p>}
    <ul className="divide-y divide-border">{query.data.map(team => <li key={team.id} className="flex min-w-0 items-center justify-between gap-3 py-4">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{team.name}</p><p className="text-xs text-muted-foreground">{team.key}{!team.canManage && ' · Only team managers can change these settings'}</p></div>
      <Button variant="outline" size="sm" disabled={!team.canManage} onClick={() => { setSelectedTeam(team); if (labels) setLabelsOpen(true); }}>{labels ? 'Manage labels' : 'Configure workflow'}</Button>
    </li>)}</ul>
    {selectedTeam && (labels
      ? <ManageLabelsDialog open={labelsOpen} onOpenChange={setLabelsOpen} initialTeamId={selectedTeam.id} />
      : <TeamSettingsDialog key={selectedTeam.id} team={selectedTeam} open onOpenChange={open => { if (!open) setSelectedTeam(null); }} />)}
  </div>;
}

export function ProjectSettings() {
  const query = useProjects();
  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError) return <Alert variant="destructive"><AlertDescription>Could not load projects. <Button variant="link" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert>;
  return <div className="flex flex-col gap-4">
    <p className="text-sm text-muted-foreground">Configuration is managed per project, not through workspace-wide defaults. Open a project to change its properties, milestones, members or linked repositories.</p>
    {!query.data?.length && <p className="text-sm text-muted-foreground">No projects are available to your account.</p>}
    <ul className="divide-y divide-border">{query.data?.map(project => <li key={project.id} className="flex min-w-0 items-center justify-between gap-3 py-4">
      <div className="min-w-0"><p className="truncate text-sm font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project.status.replaceAll('_', ' ')}</p></div>
      <Button variant="outline" size="sm" asChild><Link to={`/projects/${project.id}`} aria-label={`Open project ${project.name}`}>Open project<ArrowUpRight data-icon="inline-end" /></Link></Button>
    </li>)}</ul>
  </div>;
}
