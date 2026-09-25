import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Skeleton,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  DatePicker,
} from '@reka/ui';
import {
  ArrowLeft,
  Plus,
  FolderKanban,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Target,
} from 'lucide-react';
import { useProject, useUpdateProject, useDeleteProject } from '../hooks/use-projects';
import { useIssues } from '../../issues/hooks/use-issues';
import { IssueListView } from '../../issues/components/issue-list-view';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import type { Issue } from '@reka/types';
import type { Project } from '../api/projects.api';

function HealthBadge({ health }: { health: Project['health'] }) {
  if (health === 'on_track') {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px] font-normal gap-1 h-5">
        <CheckCircle2 className="size-2.5" />
        <span>On Track</span>
      </Badge>
    );
  }
  if (health === 'at_risk') {
    return (
      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500 text-[10px] font-normal gap-1 h-5">
        <AlertTriangle className="size-2.5" />
        <span>At Risk</span>
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-500 text-[10px] font-normal gap-1 h-5">
      <AlertCircle className="size-2.5" />
      <span>Off Track</span>
    </Badge>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isCreateIssueOpen, setIsCreateIssueOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isIssueDetailOpen, setIsIssueDetailOpen] = React.useState(false);
  const [issueFilterTab, setIssueFilterTab] = React.useState('all');

  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { data: allIssues = [] } = useIssues();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  // Filter issues belonging to this project
  const projectIssues = React.useMemo(() => {
    return allIssues.filter((i) => i.projectId === id);
  }, [allIssues, id]);

  const filteredIssues = React.useMemo(() => {
    if (issueFilterTab === 'active') {
      return projectIssues.filter((i) => i.status === 'todo' || i.status === 'in_progress' || i.status === 'in_review');
    }
    if (issueFilterTab === 'done') {
      return projectIssues.filter((i) => i.status === 'done' || i.status === 'canceled');
    }
    return projectIssues;
  }, [projectIssues, issueFilterTab]);

  const completedCount = projectIssues.filter((i) => i.status === 'done').length;
  const progressPercent = projectIssues.length > 0 ? Math.round((completedCount / projectIssues.length) * 100) : 0;

  const handleDelete = () => {
    if (!project) return;
    if (confirm(`Delete project "${project.name}"?`)) {
      deleteMutation.mutate(project.id, {
        onSuccess: () => navigate('/projects'),
      });
    }
  };

  const handleOpenIssueDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsIssueDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-40 rounded-[6px]" />
        <Skeleton className="h-32 w-full rounded-[12px]" />
        <Skeleton className="h-64 w-full rounded-[12px]" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-6 text-xs text-destructive flex items-center justify-between max-w-3xl mx-auto">
        <span>Failed to load project details.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
          <RefreshCw data-icon="inline-start" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const targetDateFormatted = project.targetDate
    ? new Date(project.targetDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No target date';

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto selection:bg-foreground selection:text-background">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Projects</span>
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleDelete}
          className="text-muted-foreground/50 hover:text-destructive"
          title="Delete project"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Project Overview Card Header */}
      <div className="rounded-[14px] border border-border/80 bg-card/40 p-6 flex flex-col gap-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-[8px] bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/70">
              <FolderKanban className="size-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {project.name}
                </h1>
                <HealthBadge health={project.health} />
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                /{project.slug}
              </p>
            </div>
          </div>

          {/* Quick Property Changers */}
          <div className="flex items-center gap-2.5">
            {/* Status Select */}
            <Select
              value={project.status}
              onValueChange={(val) => updateMutation.mutate({ id: project.id, data: { status: val } })}
            >
              <SelectTrigger className="h-8 text-xs bg-background/80 rounded-[6px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {/* Health Select */}
            <Select
              value={project.health}
              onValueChange={(val) => updateMutation.mutate({ id: project.id, data: { health: val } })}
            >
              <SelectTrigger className="h-8 text-xs bg-background/80 rounded-[6px]">
                <SelectValue placeholder="Health" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="off_track">Off Track</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
          {project.description || 'No project description added yet.'}
        </p>

        {/* Progress & Target Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-border/50">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Progress</span>
            <div className="flex items-center justify-between text-xs font-mono">
              <span>{completedCount}/{projectIssues.length} issues done</span>
              <span className="font-semibold text-foreground">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Target Date</span>
            <div className="mt-0.5">
              <DatePicker
                date={project.targetDate ? new Date(project.targetDate) : undefined}
                onDateChange={(selected) => {
                  updateMutation.mutate({
                    id: project.id,
                    data: { targetDate: selected ? selected.toISOString() : undefined },
                  });
                }}
                placeholder="Set target date"
                className="h-8 max-w-[200px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Priority</span>
            <div className="flex items-center gap-1.5 text-xs capitalize text-foreground mt-0.5">
              <Target className="size-3.5 text-muted-foreground" />
              <span>{project.priority.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Issues in Project Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">Project Issues</h2>
            <span className="font-mono text-[11px] text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {projectIssues.length}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => setIsCreateIssueOpen(true)}
            className="rounded-[6px] h-7 px-2.5 text-xs font-medium"
          >
            <Plus data-icon="inline-start" className="size-3" />
            <span>Add Issue to Project</span>
          </Button>
        </div>

        {/* Filter sub-tabs */}
        <div className="flex items-center gap-1 border-b border-border/60 pb-2">
          {[
            { id: 'all', label: 'All', count: projectIssues.length },
            { id: 'active', label: 'Active', count: projectIssues.filter((i) => i.status !== 'done' && i.status !== 'canceled').length },
            { id: 'done', label: 'Done', count: completedCount },
          ].map((tab) => {
            const isSelected = issueFilterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setIssueFilterTab(tab.id)}
                className={`h-6 px-2 text-xs rounded-[5px] font-medium transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-secondary text-foreground shadow-2xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Issue List View */}
        <IssueListView
          issues={filteredIssues}
          onSelectIssue={handleOpenIssueDetail}
        />
      </div>

      {/* Dialog for creating issue pre-assigned to this project */}
      <CreateIssueDialog
        open={isCreateIssueOpen}
        onOpenChange={setIsCreateIssueOpen}
        defaultProjectId={project.id}
      />

      {/* Detail Sheet for issues */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isIssueDetailOpen}
        onOpenChange={setIsIssueDetailOpen}
      />
    </div>
  );
}
