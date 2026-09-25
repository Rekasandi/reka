import * as React from 'react';
import type { Issue } from '@reka/types';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  Badge,
  Button,
  Textarea,
  Avatar,
  AvatarFallback,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  toast,
  useIsMobile,
} from '@reka/ui';
import {
  GitBranch,
  Copy,
  Check,
  MessageSquare,
  Activity,
  Trash2,
  Calendar,
  User,
  Plus,
  CheckCircle2,
  GitPullRequest,
  ExternalLink,
  ShieldCheck,
  Rocket,
  Tag,
  Clock,
  Terminal,
} from 'lucide-react';
import { useUpdateIssue, useDeleteIssue, useSubtasks, useCreateSubtask } from '../hooks/use-issues';
import { useIssueComments, useCreateComment, useIssueActivities } from '../hooks/use-issue-details';
import { useIssuePullRequests, useSyncBranch } from '../hooks/use-github-integration';
import { StatusPicker, STATUS_CONFIG } from './status-picker';
import { PriorityIcon } from './issue-list-view';
import { useProjects } from '../../projects/hooks/use-projects';
import { useCycles } from '../../cycles/hooks/use-cycles';
import { LinkPullRequestDialog } from './link-pr-dialog';

interface IssueDetailSheetProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'no_priority', label: 'None' },
] as const;

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatActivity(type: string) {
  return type.replace(/\./g, ' ');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IssueDetailSheet({ issue, open, onOpenChange }: IssueDetailSheetProps) {
  if (!issue) return null;

  const isMobile = useIsMobile();
  const [title, setTitle] = React.useState(issue.title);
  const [description, setDescription] = React.useState(issue.description || '');
  const [commentText, setCommentText] = React.useState('');
  const [copiedBranch, setCopiedBranch] = React.useState(false);
  const [copiedCommand, setCopiedCommand] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'comments' | 'activity'>('comments');

  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);
  const [isLinkPrOpen, setIsLinkPrOpen] = React.useState(false);

  React.useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description || '');
    setCommentText('');
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
    setIsLinkPrOpen(false);
    setActiveTab('comments');
  }, [issue]);

  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const { data: comments = [] } = useIssueComments(issue.id);
  const { data: activities = [] } = useIssueActivities(issue.id);
  const { data: subtasks = [] } = useSubtasks(issue.id);
  const { data: pullRequests = [] } = useIssuePullRequests(issue.id);
  const { data: projects = [] } = useProjects();
  const { data: cycles = [] } = useCycles();
  const commentMutation = useCreateComment(issue.id);
  const createSubtaskMutation = useCreateSubtask(issue.id);
  const syncBranchMutation = useSyncBranch(issue.id);

  const branchName = React.useMemo(() => {
    const slug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36);
    return `feature/${issue.identifier}-${slug}`;
  }, [issue]);

  const checkoutCommand = `git checkout -b ${branchName}`;

  const handleCopyBranch = () => {
    void navigator.clipboard
      .writeText(branchName)
      .then(() => {
        setCopiedBranch(true);
        toast.success('Branch name copied', { description: branchName });
        if (issue.status === 'todo' || issue.status === 'backlog') {
          syncBranchMutation.mutate({ branchName, issueIdentifier: issue.identifier });
        }
        setTimeout(() => setCopiedBranch(false), 2000);
      })
      .catch(() => {
        toast.error('Failed to copy branch name');
      });
  };

  const handleCopyCommand = () => {
    void navigator.clipboard
      .writeText(checkoutCommand)
      .then(() => {
        setCopiedCommand(true);
        toast.success('Command copied to clipboard', { description: checkoutCommand });
        if (issue.status === 'todo' || issue.status === 'backlog') {
          syncBranchMutation.mutate({ branchName, issueIdentifier: issue.identifier });
        }
        setTimeout(() => setCopiedCommand(false), 2000);
      })
      .catch(() => {
        toast.error('Failed to copy command');
      });
  };

  const handleSaveTitle = () => {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === issue.title) return;
    updateMutation.mutate({ id: issue.id, data: { title: nextTitle } });
  };

  const handleSaveDescription = () => {
    const current = (issue.description || '').trim();
    const next = description.trim();
    if (next === current) return;
    updateMutation.mutate({ id: issue.id, data: { description: next || undefined } });
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    commentMutation.mutate(commentText.trim(), {
      onSuccess: () => setCommentText(''),
    });
  };

  const handleDelete = () => {
    if (confirm(`Delete issue ${issue.identifier}?`)) {
      deleteMutation.mutate(issue.id, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    createSubtaskMutation.mutate(newSubtaskTitle.trim(), {
      onSuccess: () => {
        setNewSubtaskTitle('');
        setIsAddingSubtask(false);
      },
    });
  };

  const handleToggleSubtask = (subtask: Issue) => {
    const nextStatus = subtask.status === 'done' ? 'todo' : 'done';
    updateMutation.mutate({ id: subtask.id, data: { status: nextStatus as any } });
  };

  const doneSubtasksCount = subtasks.filter((s) => s.status === 'done').length;

  const renderPanel = () => (
    <div className="flex min-h-0 flex-1 flex-col bg-background font-sans selection:bg-foreground selection:text-background">
      {/* Header bar: Hairline border, precise Geist typography, minimal controls */}
      <div className="border-b border-border/80 bg-background/95 backdrop-blur-xs px-6 py-3.5 pr-14 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-6 rounded-[6px] border border-border bg-card/60 px-2 font-mono text-[11px] font-semibold text-foreground flex items-center">
            {issue.identifier}
          </span>

          {/* Quick Copy Branch */}
          <button
            type="button"
            onClick={handleCopyBranch}
            className="flex h-6 min-w-0 items-center gap-1.5 rounded-[6px] border border-border/70 bg-card/40 px-2 text-[11px] font-mono text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.98]"
            title="Copy Git Branch Name"
          >
            <GitBranch className="size-3 text-muted-foreground" />
            <span className="truncate max-w-[160px]">{branchName}</span>
            {copiedBranch ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          </button>

          {/* Quick Copy Git Checkout Command */}
          <button
            type="button"
            onClick={handleCopyCommand}
            className="hidden sm:flex h-6 items-center gap-1.5 rounded-[6px] border border-border/70 bg-card/40 px-2 text-[11px] font-mono text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.98]"
            title="Copy 'git checkout -b' command"
          >
            <Terminal className="size-3 text-muted-foreground" />
            <span>git checkout</span>
            {copiedCommand ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          </button>

          {/* GitHub Issue Sync Link */}
          {issue.githubIssueNumber && issue.githubIssueUrl && (
            <a
              href={issue.githubIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-6 items-center gap-1.5 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 px-2 text-[11px] font-mono text-emerald-500 transition-colors hover:bg-emerald-500/20"
              title="Open GitHub Issue"
            >
              <span>GH #{issue.githubIssueNumber}</span>
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
            title="Delete issue"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-7">
          {/* Title: Geist display style with tight negative tracking, borderless default */}
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              spellCheck={false}
              className="w-full bg-transparent px-0 py-1 text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground outline-hidden transition-colors border-b border-transparent hover:border-border/50 focus:border-border"
              placeholder="Issue title"
            />
          </div>

          {/* Properties Grid: Level-0 hairline flat card adhering to DESIGN.md */}
          <div className="rounded-[12px] border border-border/80 bg-card/40 p-3.5 grid grid-cols-2 sm:grid-cols-6 gap-3">
            {/* Project Select */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Project</span>
              <Select
                value={issue.projectId || 'none'}
                onValueChange={(val) => updateMutation.mutate({ id: issue.id, data: { projectId: val === 'none' ? null : val } as any })}
              >
                <SelectTrigger className="h-8 w-full rounded-[6px] border border-border/60 bg-background/80 px-2 text-xs font-medium hover:border-border">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No Project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Cycle Select */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cycle</span>
              <Select
                value={issue.cycleId || 'none'}
                onValueChange={(val) => updateMutation.mutate({ id: issue.id, data: { cycleId: val === 'none' ? null : val } as any })}
              >
                <SelectTrigger className="h-8 w-full rounded-[6px] border border-border/60 bg-background/80 px-2 text-xs font-medium hover:border-border">
                  <SelectValue placeholder="Cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No Cycle</SelectItem>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name || `Cycle ${c.number}`}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Status Select */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</span>
              <Select
                value={issue.status}
                onValueChange={(val) => updateMutation.mutate({ id: issue.id, data: { status: val as any } })}
              >
                <SelectTrigger className="h-8 w-full rounded-[6px] border border-border/60 bg-background/80 px-2 text-xs font-medium hover:border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div className="shrink-0">{cfg.renderIcon()}</div>
                          <span>{cfg.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Priority</span>
              <Select
                value={issue.priority}
                onValueChange={(val) => updateMutation.mutate({ id: issue.id, data: { priority: val as any } })}
              >
                <SelectTrigger className="h-8 w-full rounded-[6px] border border-border/60 bg-background/80 px-2 text-xs font-medium hover:border-border">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <PriorityIcon priority={opt.value} />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Type</span>
              <div className="flex h-8 items-center">
                <Badge variant="outline" className="h-8 w-full rounded-[6px] border border-border/60 bg-background/80 px-2.5 font-mono text-[11px] font-normal capitalize text-foreground justify-start">
                  {issue.type}
                </Badge>
              </div>
            </div>

            {/* Assignee */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Assignee</span>
              <div className="flex h-8 items-center gap-2 rounded-[6px] border border-border/60 bg-background/80 px-2.5">
                <Avatar className="size-4.5 rounded-full">
                  <AvatarFallback className="text-[10px] font-medium bg-secondary text-foreground">G</AvatarFallback>
                </Avatar>
                <span className="truncate text-xs font-medium text-foreground">Gustam</span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Description</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              placeholder="Add description, acceptance criteria, or context..."
              rows={5}
              className="min-h-[140px] resize-y rounded-[8px] border border-border/80 bg-card/30 p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Sub-tasks Section: Linear style sub-issue tracker */}
          <div className="rounded-[12px] border border-border/80 bg-card/30 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sub-tasks</span>
                {subtasks.length > 0 && (
                  <span className="font-mono text-[11px] text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded-[4px] border border-border/50">
                    {doneSubtasksCount}/{subtasks.length}
                  </span>
                )}
              </div>

              {!isAddingSubtask && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsAddingSubtask(true)}
                  className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2 rounded-[5px]"
                >
                  <Plus className="size-3" />
                  <span>Add sub-task</span>
                </Button>
              )}
            </div>

            {/* Sub-tasks List */}
            {subtasks.length > 0 && (
              <div className="rounded-[8px] border border-border/70 divide-y divide-border/50 bg-background/60 overflow-hidden">
                {subtasks.map((st) => {
                  const isDone = st.status === 'done';
                  return (
                    <div
                      key={st.id}
                      className="flex items-center justify-between px-3 py-2 text-xs gap-3 hover:bg-secondary/40 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSubtask(st)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          title={isDone ? 'Mark as todo' : 'Mark as done'}
                        >
                          <CheckCircle2
                            className={`size-4 transition-colors ${
                              isDone ? 'text-primary fill-primary/20' : 'text-muted-foreground/50 hover:text-muted-foreground'
                            }`}
                          />
                        </button>
                        <span className="font-mono text-[11px] text-muted-foreground font-semibold shrink-0">
                          {st.identifier}
                        </span>
                        <span className={`truncate text-xs ${isDone ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>
                          {st.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityIcon priority={st.priority} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteMutation.mutate(st.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive size-5 p-0"
                          title="Delete sub-task"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Inline Add Sub-task Form */}
            {isAddingSubtask && (
              <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  autoFocus
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Sub-task title..."
                  className="flex-1 h-8 px-2.5 rounded-[6px] border border-border/80 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 outline-hidden focus:border-ring transition-colors"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                  className="h-8 text-xs px-2.5 rounded-[6px]"
                >
                  {createSubtaskMutation.isPending ? 'Adding...' : 'Add'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingSubtask(false);
                    setNewSubtaskTitle('');
                  }}
                  className="h-8 text-xs px-2 text-muted-foreground rounded-[6px]"
                >
                  Cancel
                </Button>
              </form>
            )}

            {subtasks.length === 0 && !isAddingSubtask && (
              <p className="text-[11px] text-muted-foreground/60 italic py-1">
                No sub-tasks yet. Break this issue down into smaller steps.
              </p>
            )}
          </div>

          {/* GitHub Integration Section (Linear PR Workflow, CI Checks & Review Status) */}
          <div className="rounded-[12px] border border-border/80 bg-card/30 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  GitHub Pull Requests & CI
                </span>
                {pullRequests.length > 0 && (
                  <Badge variant="outline" className="font-mono text-[10px] h-4.5 px-1.5 border-border/60">
                    {pullRequests.length}
                  </Badge>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setIsLinkPrOpen(true)}
                className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1.5 px-2 rounded-[5px]"
              >
                <GitPullRequest className="size-3" />
                <span>Link PR</span>
              </Button>
            </div>

            {/* PR List with CI/CD Checks and Reviewers */}
            {pullRequests.length > 0 ? (
              <div className="rounded-[8px] border border-border/70 divide-y divide-border/50 bg-background/60 overflow-hidden">
                {pullRequests.map((pr) => (
                  <div key={pr.id} className="flex flex-col p-3 gap-2.5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-6 rounded-[5px] bg-secondary flex items-center justify-center shrink-0 border border-border/60">
                          <GitPullRequest className={`size-3.5 ${pr.merged ? 'text-purple-400' : 'text-emerald-500'}`} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-foreground">#{pr.prNumber}</span>
                            <span className="truncate text-foreground font-medium">{pr.title}</span>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground truncate">
                            branch: {pr.branchName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono h-5 px-1.5 capitalize ${
                            pr.merged
                              ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                          }`}
                        >
                          {pr.merged ? 'Merged' : pr.state}
                        </Badge>

                        <Button variant="ghost" size="icon-xs" asChild className="size-6 p-0 text-muted-foreground hover:text-foreground">
                          <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" title="View PR on GitHub">
                            <ExternalLink className="size-3" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    {/* CI / CD Checks & Review Badges Strip */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-[11px] font-mono">
                      {/* CI Status */}
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {pr.ciStatus === 'success' ? (
                          <span className="text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="size-3 text-emerald-500" />
                            <span>CI Checks Passing</span>
                          </span>
                        ) : pr.ciStatus === 'failure' ? (
                          <span className="text-red-500 flex items-center gap-1">
                            <Trash2 className="size-3 text-red-500" />
                            <span>CI Failed</span>
                          </span>
                        ) : (
                          <span className="text-amber-500 flex items-center gap-1">
                            <Clock className="size-3 text-amber-500" />
                            <span>Checks In Progress</span>
                          </span>
                        )}
                      </span>

                      <span>&bull;</span>

                      {/* Code Review Status */}
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ShieldCheck className="size-3 text-muted-foreground" />
                        <span className={pr.reviewStatus === 'approved' ? 'text-emerald-500' : ''}>
                          {pr.reviewStatus === 'approved'
                            ? 'Approved by Lead'
                            : pr.reviewStatus === 'changes_requested'
                            ? 'Changes Requested'
                            : 'Review Pending'}
                        </span>
                      </span>

                      {/* Preview / Deployment */}
                      {pr.deployUrl && (
                        <>
                          <span>&bull;</span>
                          <a
                            href={pr.deployUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Rocket className="size-3" />
                            <span>{pr.deployEnv === 'production' ? 'Production' : 'Preview'}</span>
                          </a>
                        </>
                      )}

                      {/* Release Tag */}
                      {pr.releaseTag && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Tag className="size-3" />
                            <span>{pr.releaseTag}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-[8px] border border-dashed border-border/60 text-xs text-muted-foreground">
                <span className="text-[11px]">No pull request linked yet.</span>
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  Auto-transitions on PR open / merge
                </span>
              </div>
            )}
          </div>

          {/* Discussion & Activity Section: Clean Tabs adhering to shadcn line variant */}
          <div className="rounded-[12px] border border-border/80 bg-card/20 p-4 sm:p-5 flex flex-col gap-4">
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as 'comments' | 'activity')}
              className="flex-col gap-4 w-full"
            >
              <TabsList variant="line" className="h-9 w-fit justify-start gap-6 p-0 border-b border-border/60 pb-1">
                <TabsTrigger
                  value="comments"
                  className="h-8 flex-none rounded-none border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground relative"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Comments ({comments.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="h-8 flex-none rounded-none border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground relative"
                >
                  <Activity className="size-3.5" />
                  <span>Activity ({activities.length})</span>
                </TabsTrigger>
              </TabsList>

              {/* Comments Tab Content */}
              <TabsContent value="comments" className="mt-0 w-full space-y-4">
                {/* New Comment Box */}
                <form onSubmit={handlePostComment} className="rounded-[8px] border border-border/80 bg-background/90 p-3 shadow-2xs focus-within:border-ring transition-colors">
                  <div className="flex items-start gap-2.5">
                    <Avatar className="mt-0.5 size-5 shrink-0 rounded-full">
                      <AvatarFallback className="text-[10px] font-medium bg-secondary text-foreground">G</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        placeholder="Leave a comment or review note..."
                        rows={3}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="min-h-[80px] w-full resize-none border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 leading-relaxed"
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!commentText.trim() || commentMutation.isPending}
                      className="h-7 rounded-[6px] px-3 text-xs font-medium"
                    >
                      {commentMutation.isPending ? 'Posting...' : 'Comment'}
                    </Button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-2.5">
                  {comments.map((comment) => (
                    <article key={comment.id} className="rounded-[8px] border border-border/70 bg-background/60 p-3.5 transition-colors hover:border-border">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-4.5 rounded-full">
                            <AvatarFallback className="text-[9px] bg-secondary text-foreground font-medium">
                              {(comment.authorName || 'G')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-foreground text-xs">{comment.authorName || 'Gustam'}</span>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground/70">{formatDateTime(comment.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 pl-6.5">{comment.body}</p>
                    </article>
                  ))}

                  {comments.length === 0 && (
                    <div className="rounded-[8px] border border-dashed border-border/60 bg-background/40 py-8 text-center text-xs text-muted-foreground">
                      No comments yet. Leave a note or update.
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Activity Tab Content */}
              <TabsContent value="activity" className="mt-0 w-full">
                <div className="space-y-2">
                  {activities.map((item) => (
                    <div key={item.id} className="flex items-start gap-2.5 rounded-[8px] border border-border/60 bg-background/40 p-3 text-xs">
                      <div className="mt-1 size-1.5 shrink-0 rounded-full bg-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <p className="leading-relaxed text-foreground">
                          <span className="font-semibold">{item.actorName || 'System'}</span>{' '}
                          <span className="text-muted-foreground">{formatActivity(item.type)}</span>
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">{formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                  ))}

                  {activities.length === 0 && (
                    <div className="rounded-[8px] border border-dashed border-border/60 bg-background/40 py-8 text-center text-xs text-muted-foreground">
                      No activity recorded yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] gap-0 border-t border-border bg-background p-0">
          <DrawerTitle className="sr-only">Issue {issue.identifier}</DrawerTitle>
          <DrawerDescription className="sr-only">Issue details and discussion</DrawerDescription>
          {renderPanel()}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-3xl gap-0 border-l border-border bg-background p-0 shadow-2xl">
        <SheetTitle className="sr-only">Issue {issue.identifier}</SheetTitle>
        <SheetDescription className="sr-only">Issue details and discussion</SheetDescription>
        {renderPanel()}
      </SheetContent>

      {/* Link PR Dialog */}
      <LinkPullRequestDialog
        issueId={issue.id}
        issueIdentifier={issue.identifier}
        branchName={branchName}
        open={isLinkPrOpen}
        onOpenChange={setIsLinkPrOpen}
      />
    </Sheet>
  );
}
