import * as React from 'react';
import { getIssueStatusCategory, type Issue } from '@reka/types';
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
  Archive,
  RotateCcw,
  Star,
  Bell,
  Paperclip,
  Download,
  Pencil,
} from 'lucide-react';
import { useUpdateIssue, useDeleteIssue, useSubtasks, useCreateSubtask, useArchiveIssue, useIssues } from '../hooks/use-issues';
import { useIssueComments, useCreateComment, useUpdateComment, useDeleteComment, useIssueActivities, useIssueRelations, useIssueRelationMutations, useIssueSubscription, useIssueAttachments, useIssueAttachmentMutations } from '../hooks/use-issue-details';
import { useIssueBranches, useIssuePullRequests } from '../hooks/use-github-integration';
import { StatusPicker } from './status-picker';
import { PriorityIcon, PriorityPicker } from './priority-picker';
import { IssueTypePicker } from './issue-type-picker';
import { AssigneePicker } from './assignee-picker';
import { ProjectPicker } from './project-picker';
import { CyclePicker } from './cycle-picker';
import { LinkPullRequestDialog } from './link-pr-dialog';
import { IssueLabelsPicker } from './issue-labels-picker';
import { IssueRecurrenceSection } from './issue-recurrence-section';
import { useTeamWorkflowStates } from '../../teams/hooks/use-teams';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { useUsers } from '../../users/hooks/use-users';
import { useAuthStore } from '../../../stores/auth.store';

interface IssueDetailSheetProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFavorite?: boolean;
  canFavorite?: boolean;
  onToggleFavorite?: () => void;
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatActivity(type: string, metadata?: Record<string, any>) {
  const pr = metadata?.prNumber ? ` PR #${metadata.prNumber}` : '';
  const branch = metadata?.branchName ? ` branch ${metadata.branchName}` : '';
  const labels: Record<string, string> = {
    'github.pr_opened': `opened${pr}`,
    'github.pr_merged': `merged${pr}`,
    'github.pr_closed': `closed${pr} without merge`,
    'github.pr_review_approved': `approved${pr}`,
    'github.pr_review_changes_requested': `requested changes on${pr}`,
    'github.pr_review_requested': `requested review on${pr}`,
    'github.branch_created': `created${branch}`,
    'github.branch_updated': `updated${branch}`,
    'github.branch_deleted': `deleted${branch}`,
  };
  const label = labels[type] ?? type.replace(/\./g, ' ');
  return metadata?.statusFrom && metadata?.statusTo ? `${label} (${formatStatus(metadata.statusFrom)} → ${formatStatus(metadata.statusTo)})` : label;
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

export function IssueDetailSheet({ issue, open, onOpenChange, isFavorite = false, canFavorite = true, onToggleFavorite }: IssueDetailSheetProps) {
  if (!issue) return null;

  const isMobile = useIsMobile();
  const [title, setTitle] = React.useState(issue.title);
  const [description, setDescription] = React.useState(issue.description || '');
  const [estimate, setEstimate] = React.useState(issue.estimate == null ? '' : String(issue.estimate));
  const [dueDate, setDueDate] = React.useState(issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : '');
  const [relationTargetId, setRelationTargetId] = React.useState('');
  const [relationType, setRelationType] = React.useState<'blocks' | 'blocked_by' | 'related_to' | 'duplicate'>('blocks');
  const [commentText, setCommentText] = React.useState('');
  const [mentionToken, setMentionToken] = React.useState<{ query: string; start: number; cursor: number } | null>(null);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = React.useState('');
  const commentInputRef = React.useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);
  const [copiedBranch, setCopiedBranch] = React.useState(false);
  const [copiedCommand, setCopiedCommand] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'comments' | 'activity'>('comments');

  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);
  const [isLinkPrOpen, setIsLinkPrOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const currentUser = useAuthStore(state => state.user);

  React.useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description || '');
    setEstimate(issue.estimate == null ? '' : String(issue.estimate));
    setDueDate(issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : '');
    setRelationTargetId('');
    setCommentText('');
    setMentionToken(null);
    setEditingCommentId(null);
    setEditCommentBody('');
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
    setIsLinkPrOpen(false);
    setActiveTab('comments');
  }, [issue]);

  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const archiveMutation = useArchiveIssue();
  const { data: visibleIssues = [] } = useIssues();
  const { data: workflowStates = [] } = useTeamWorkflowStates(issue.teamId);
  const { data: relations = [], isLoading: relationsLoading, isError: relationsError, refetch: refetchRelations } = useIssueRelations(issue.id);
  const relationMutations = useIssueRelationMutations(issue.id);
  const { data: comments = [], isLoading: commentsLoading, isError: commentsError, refetch: refetchComments } = useIssueComments(issue.id);
  const { data: activities = [], isLoading: activitiesLoading, isError: activitiesError, refetch: refetchActivities } = useIssueActivities(issue.id);
  const { data: candidates = [], isLoading: candidatesLoading, isError: candidatesError, refetch: refetchCandidates } = useUsers();
  const { data: subscription, isLoading: subscriptionLoading, isError: subscriptionError, refetch: refetchSubscription, mutation: subscriptionMutation } = useIssueSubscription(issue.id);
  const { data: attachments = [], isLoading: attachmentsLoading, isError: attachmentsError, refetch: refetchAttachments } = useIssueAttachments(issue.id);
  const attachmentMutations = useIssueAttachmentMutations(issue.id);
  const updateCommentMutation = useUpdateComment(issue.id);
  const deleteCommentMutation = useDeleteComment(issue.id);
  const { data: subtasks = [] } = useSubtasks(issue.id);
  const { data: pullRequests = [], isLoading: pullRequestsLoading, isError: pullRequestsError, refetch: refetchPullRequests } = useIssuePullRequests(issue.id);
  const { data: linkedBranches = [], isLoading: branchesLoading, isError: branchesError, refetch: refetchBranches } = useIssueBranches(issue.id);
  const commentMutation = useCreateComment(issue.id);
  const createSubtaskMutation = useCreateSubtask(issue.id, issue.teamId);
  const mentionSuggestions = React.useMemo(() => {
    const query = mentionToken?.query.toLowerCase() ?? '';
    if (!mentionToken) return [];
    return candidates.filter(user => {
      const handle = user.githubUsername || user.email.split('@')[0];
      return `${user.name} ${handle} ${user.email}`.toLowerCase().includes(query);
    }).slice(0, 6);
  }, [candidates, mentionToken]);

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

  const handleSaveEstimate = () => {
    if (estimate !== '' && (!Number.isInteger(Number(estimate)) || Number(estimate) < 0 || Number(estimate) > 100)) {
      toast.error('Estimate must be a whole number from 0 to 100');
      return;
    }
    const next = estimate === '' ? null : Number(estimate);
    if (next === (issue.estimate ?? null)) return;
    updateMutation.mutate({ id: issue.id, data: { estimate: next } });
  };

  const handleSaveDueDate = () => {
    const current = issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : '';
    if (current === dueDate) return;
    updateMutation.mutate({ id: issue.id, data: { dueDate: dueDate || null } });
  };

  const updateMentionToken = (value: string, cursor: number) => {
    const match = /(?:^|\s)@([\w.-]*)$/.exec(value.slice(0, cursor));
    if (!match) { setMentionToken(null); return; }
    const at = match[0].lastIndexOf('@');
    setMentionToken({ query: match[1], start: cursor - match[0].length + at, cursor });
  };

  const insertMention = (user: (typeof candidates)[number]) => {
    if (!mentionToken) return;
    const handle = user.githubUsername || user.email.split('@')[0] || user.name.replace(/\s+/g, '');
    const next = `${commentText.slice(0, mentionToken.start)}@${handle} ${commentText.slice(mentionToken.cursor)}`;
    const cursor = mentionToken.start + handle.length + 2;
    setCommentText(next); setMentionToken(null);
    requestAnimationFrame(() => { commentInputRef.current?.focus(); commentInputRef.current?.setSelectionRange(cursor, cursor); });
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim(), { onSuccess: () => { setCommentText(''); setMentionToken(null); } });
  };

  const handleUploadAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) attachmentMutations.upload.mutate(file);
    event.target.value = '';
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
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
    const isCompleted = getIssueStatusCategory(subtask) === 'completed';
    const nextStatus = isCompleted
      ? workflowStates.find((state) => ['backlog', 'unstarted'].includes(state.category))?.key ?? 'todo'
      : workflowStates.find((state) => state.category === 'completed')?.key ?? 'done';
    updateMutation.mutate({ id: subtask.id, data: { status: nextStatus as any } });
  };

  const doneSubtasksCount = subtasks.filter((subtask) => getIssueStatusCategory(subtask) === 'completed').length;

  const renderPanel = () => (
    <div className="flex min-h-0 flex-1 flex-col bg-background font-sans selection:bg-foreground selection:text-background">
      {/* Header bar: Hairline border, precise Geist typography, minimal controls */}
      <div className="border-b border-border/80 bg-background/95 backdrop-blur-xs px-6 py-3 pr-14 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-6 rounded-[6px] border border-border bg-card/60 px-2 font-mono text-xs font-semibold text-foreground flex items-center">
            {issue.identifier}
          </span>

          {/* Quick Copy Branch */}
          <button
            type="button"
            onClick={handleCopyBranch}
            className="flex h-6 min-w-0 items-center gap-1.5 rounded-[6px] border border-border/70 bg-card/40 px-2 text-xs font-mono text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.98]"
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
            className="hidden sm:flex h-6 items-center gap-1.5 rounded-[6px] border border-border/70 bg-card/40 px-2 text-xs font-mono text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-[0.98]"
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
              className="flex h-6 items-center gap-1.5 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 px-2 text-xs font-mono text-emerald-500 transition-colors hover:bg-emerald-500/20"
              title="Open GitHub Issue"
            >
              <span>GH #{issue.githubIssueNumber}</span>
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon-xs" aria-label={subscriptionError ? 'Retry follow status' : subscription?.subscribed ? 'Unfollow issue' : 'Follow issue'} title={subscriptionError ? 'Could not load follow status; retry' : subscription?.subscribed ? 'Unfollow issue' : 'Follow issue'} disabled={subscriptionLoading || subscriptionMutation.isPending} onClick={() => subscriptionError ? void refetchSubscription() : subscriptionMutation.mutate(!subscription?.subscribed)}><Bell className={subscription?.subscribed ? 'fill-current text-primary' : ''} /></Button>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={isFavorite ? 'Remove issue from favorites' : 'Add issue to favorites'} title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} disabled={!canFavorite} onClick={onToggleFavorite}><Star className={isFavorite ? 'fill-current text-amber-500' : ''} /></Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={issue.archivedAt ? 'Restore issue' : 'Archive issue'}
            title={issue.archivedAt ? 'Restore issue' : 'Archive issue'}
            onClick={() => archiveMutation.mutate({ id: issue.id, restore: !!issue.archivedAt }, { onSuccess: () => onOpenChange(false) })}
          >
            {issue.archivedAt ? <RotateCcw className="size-3.5" /> : <Archive className="size-3.5" />}
          </Button>
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
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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

          {/* Properties: Clean Linear-style metadata panel adhering to Geist tokens */}
          <div className="rounded-lg border border-border/70 bg-card/20 p-3 grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {/* Status Select */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <StatusPicker teamId={issue.teamId} status={issue.status} appearance="badge" className="h-8 w-full justify-start" onStatusChange={(status) => updateMutation.mutate({ id: issue.id, data: { status: status as Issue['status'] } })} />
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Priority</span>
              <PriorityPicker priority={issue.priority} appearance="badge" className="h-8 w-full justify-start" onPriorityChange={(priority) => updateMutation.mutate({ id: issue.id, data: { priority: priority as Issue['priority'] } })} />
            </div>

            {/* Assignee */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Assignee</span>
              <AssigneePicker
                assigneeId={issue.assigneeId}
                onAssigneeChange={(userId) =>
                  updateMutation.mutate({ id: issue.id, data: { assigneeId: userId } })
                }
              />
            </div>

            {/* Project Select */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Project</span>
              <ProjectPicker projectId={issue.projectId ?? null} identifier={issue.identifier} className="h-8 w-full justify-start" onProjectChange={projectId => updateMutation.mutate({ id: issue.id, data: { projectId } })} />
            </div>

            {/* Cycle Select */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Cycle</span>
              <CyclePicker cycleId={issue.cycleId ?? null} teamId={issue.teamId} identifier={issue.identifier} className="h-8 w-full justify-start" onCycleChange={cycleId => updateMutation.mutate({ id: issue.id, data: { cycleId } })} />
            </div>

            {/* Type */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <IssueTypePicker type={issue.type} identifier={issue.identifier} className="h-8 w-full justify-start" onTypeChange={(type) => updateMutation.mutate({ id: issue.id, data: { type } })} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="issue-estimate" className="text-xs font-medium text-muted-foreground">Estimate</label>
              <input id="issue-estimate" type="number" min={0} max={100} step={1} value={estimate} onChange={(event) => setEstimate(event.target.value)} onBlur={handleSaveEstimate} className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" aria-label="Issue estimate" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="issue-due-date" className="text-xs font-medium text-muted-foreground">Due date</label>
              <input id="issue-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} onBlur={handleSaveDueDate} className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs" aria-label="Issue due date" />
            </div>
          </div>
          <IssueLabelsPicker teamId={issue.teamId} projectId={issue.projectId} value={(issue.labels || []).map((label) => label.id)} onChange={(labelIds) => updateMutation.mutate({ id: issue.id, data: { labelIds } })} />

          {/* Description Section */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Description</span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              placeholder="Add description, acceptance criteria, or context..."
              rows={5}
              className="min-h-[140px] resize-y rounded-lg border border-border/70 bg-card/20 p-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <section aria-label="Issue attachments" className="rounded-lg border border-border/70 bg-card/20 p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Paperclip className="size-3.5 text-muted-foreground" /><span className="text-xs font-medium">Attachments</span><Badge variant="outline">{attachments.length}</Badge></div><div className="flex items-center gap-2"><input ref={attachmentInputRef} type="file" aria-label="Choose issue attachment" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown" className="sr-only" onChange={handleUploadAttachment} /><Button type="button" size="xs" variant="outline" disabled={attachmentMutations.upload.isPending || Boolean(issue.archivedAt)} onClick={() => attachmentInputRef.current?.click()}>{attachmentMutations.upload.isPending ? 'Uploading…' : 'Upload file'}</Button></div></div>
            <p className="text-xs text-muted-foreground">PNG, JPEG, GIF, WebP, PDF or UTF-8 text · up to 5 MiB. Files are private to people who can read this issue.</p>
            {attachmentsLoading && <p role="status" className="text-xs text-muted-foreground">Loading attachments…</p>}
            {attachmentsError && <div role="alert" className="flex items-center gap-2 text-xs text-destructive">Could not load attachments.<Button type="button" size="xs" variant="ghost" onClick={() => void refetchAttachments()}>Retry</Button></div>}
            {!attachmentsLoading && !attachmentsError && attachments.length === 0 && <p className="text-xs text-muted-foreground">No attachments yet.</p>}
            {attachments.map(file => <div key={file.id} className="flex min-w-0 items-center gap-2 border-t border-border/50 pt-2 text-xs"><Paperclip className="size-3 shrink-0 text-muted-foreground" /><a className="min-w-0 flex-1 truncate hover:underline" href={file.url} download={file.fileName} aria-label={`Download ${file.fileName}`}>{file.fileName}</a><span className="shrink-0 text-muted-foreground">{Math.max(1, Math.ceil(file.fileSize / 1024))} KB</span>{file.canDelete && <Button type="button" variant="ghost" size="icon-xs" aria-label={`Delete attachment ${file.fileName}`} disabled={attachmentMutations.remove.isPending} onClick={() => { if (window.confirm(`Delete ${file.fileName}?`)) attachmentMutations.remove.mutate(file.id); }}><Trash2 className="size-3" /></Button>}</div>)}
          </section>

          {/* Relations */}
          <section aria-label="Issue relations" className="rounded-lg border border-border/70 bg-card/20 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between"><span className="text-xs font-medium">Relations & dependencies</span><span className="font-mono text-xs text-muted-foreground">{relations.length}</span></div>
            {relationsLoading ? <p className="text-xs text-muted-foreground">Loading relations…</p> : null}
            {relationsError ? <Button type="button" variant="ghost" size="xs" onClick={() => void refetchRelations()}>Retry relations</Button> : null}
            {relations.map(({ type, relatedIssue, duplicateDirection }) => {
              const label = type === 'duplicate' ? (duplicateDirection === 'source' ? 'duplicate of' : duplicateDirection === 'target' ? 'duplicate source' : 'duplicate') : type.replaceAll('_', ' ');
              return <div key={`${type}:${relatedIssue.id}`} className="flex items-center gap-2 text-xs">
                <span className="rounded border border-border px-1.5 py-0.5 text-muted-foreground">{label}</span>
                <span className="font-mono text-muted-foreground">{relatedIssue.identifier}</span>
                <span className="min-w-0 flex-1 truncate">{relatedIssue.title}</span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${type} relation to ${relatedIssue.identifier}`} onClick={() => relationMutations.remove.mutate({ relatedIssueId: relatedIssue.id, type })}><Trash2 /></Button>
              </div>;
            })}
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="issue-relation-type">Relation type</label>
              <select id="issue-relation-type" value={relationType} onChange={(event) => setRelationType(event.target.value as typeof relationType)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                <option value="blocks">Blocks</option><option value="blocked_by">Blocked by</option><option value="related_to">Related to</option><option value="duplicate">Duplicate of</option>
              </select>
              <label className="sr-only" htmlFor="issue-relation-target">Related issue</label>
              <select id="issue-relation-target" value={relationTargetId} onChange={(event) => setRelationTargetId(event.target.value)} className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs">
                <option value="">Select same-team issue…</option>
                {visibleIssues.filter((candidate) => candidate.teamId === issue.teamId && candidate.id !== issue.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.identifier} — {candidate.title}</option>)}
              </select>
              <Button type="button" size="sm" disabled={!relationTargetId || relationMutations.add.isPending} onClick={() => relationMutations.add.mutate({ relatedIssueId: relationTargetId, type: relationType }, { onSuccess: () => setRelationTargetId('') })}>Add relation</Button>
            </div>
          </section>

          <IssueRecurrenceSection issueId={issue.id} archived={Boolean(issue.archivedAt)} />

          {/* Sub-tasks Section: Linear style sub-issue tracker */}
          <div className="rounded-lg border border-border/70 bg-card/20 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">Sub-tasks</span>
                {subtasks.length > 0 && (
                  <span className="font-mono text-xs text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded border border-border/50">
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
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3" />
                  <span>Add sub-task</span>
                </Button>
              )}
            </div>

            {/* Sub-tasks List */}
            {subtasks.length > 0 && (
              <div className="rounded-[6px] border border-border/70 divide-y divide-border/50 bg-background/60 overflow-hidden">
                {subtasks.map((st) => {
                  const isDone = getIssueStatusCategory(st) === 'completed';
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
                        <span className="font-mono text-xs text-muted-foreground font-semibold shrink-0">
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
                  className="px-2.5"
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
                  className="px-2 text-muted-foreground"
                >
                  Cancel
                </Button>
              </form>
            )}

            {subtasks.length === 0 && !isAddingSubtask && (
              <p className="text-xs text-muted-foreground/60 italic py-1">
                No sub-tasks yet. Break this issue down into smaller steps.
              </p>
            )}
          </div>

          {/* GitHub Integration Section (Linear PR Workflow, CI Checks & Review Status) */}
          <div className="rounded-lg border border-border/70 bg-card/20 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  GitHub Pull Requests & CI
                </span>
                {pullRequests.length > 0 && (
                  <Badge variant="outline" className="font-mono text-xs h-5 px-1.5 border-border/60">
                    {pullRequests.length}
                  </Badge>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setIsLinkPrOpen(true)}
                className="h-6 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2 rounded-[5px]"
              >
                <GitPullRequest className="size-3" />
                <span>Link PR</span>
              </Button>
            </div>

            {/* PR List with CI/CD Checks and Reviewers */}
            {pullRequests.length > 0 ? (
              <div className="rounded-[6px] border border-border/70 divide-y divide-border/50 bg-background/60 overflow-hidden">
                {pullRequests.map((pr) => (
                  <div key={pr.id} className="flex flex-col p-3 gap-2.5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between text-xs gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-6 rounded-[5px] bg-secondary flex items-center justify-center shrink-0 border border-border/60">
                          <GitPullRequest className={`size-3.5 ${pr.merged ? 'text-purple-400' : pr.state === 'open' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-semibold text-foreground">#{pr.prNumber}</span>
                            <span className="truncate text-foreground font-medium">{pr.title}</span>
                          </div>
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            branch: {pr.branchName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono h-5 px-1.5 capitalize ${
                            pr.merged
                              ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                              : pr.state === 'open' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' : 'border-border bg-muted text-muted-foreground'
                          }`}
                        >
                          {pr.merged ? 'Merged' : pr.state === 'closed' ? 'Closed unmerged' : pr.state}
                        </Badge>

                        <Button variant="ghost" size="icon-xs" asChild className="size-6 p-0 text-muted-foreground hover:text-foreground">
                          <a href={pr.htmlUrl} target="_blank" rel="noopener noreferrer" title="View PR on GitHub">
                            <ExternalLink className="size-3" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    {/* CI / CD Checks & Review Badges Strip */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-xs font-mono">
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
                            <span>CI status not reported</span>
                          </span>
                        )}
                      </span>

                      <span>&bull;</span>

                      {/* Code Review Status */}
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ShieldCheck className="size-3 text-muted-foreground" />
                        <span className={pr.reviewStatus === 'approved' ? 'text-emerald-500' : ''}>
                          {pr.reviewStatus === 'approved'
                            ? 'Approved'
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
            ) : pullRequestsLoading ? (
              <p role="status" className="text-xs text-muted-foreground">Loading pull requests…</p>
            ) : pullRequestsError ? (
              <div className="flex items-center justify-between gap-2 text-xs text-destructive">
                <span>Could not load pull requests.</span>
                <Button type="button" size="xs" variant="outline" onClick={() => void refetchPullRequests()}>Retry</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-2.5 rounded-[6px] border border-dashed border-border/60 text-xs text-muted-foreground">
                <span>No pull request linked yet.</span>
                <span className="font-mono text-xs text-muted-foreground/80">Links update when GitHub events arrive.</span>
              </div>
            )}

            <div className="border-t border-border/50 pt-3 flex flex-col gap-2">
              <span className="text-xs font-medium text-foreground">Linked branches</span>
              {branchesLoading ? <p role="status" className="text-xs text-muted-foreground">Loading branches…</p>
                : branchesError ? <div className="flex items-center justify-between gap-2 text-xs text-destructive"><span>Could not load branches.</span><Button type="button" size="xs" variant="outline" onClick={() => void refetchBranches()}>Retry</Button></div>
                : linkedBranches.length ? <ul className="space-y-1.5">{linkedBranches.map(branch => <li key={branch.id} className="flex min-w-0 items-center justify-between gap-2 text-xs"><a className="flex min-w-0 items-center gap-2 truncate text-muted-foreground hover:text-foreground hover:underline" href={`https://github.com/${branch.repositoryName}/tree/${encodeURIComponent(branch.name)}`} target="_blank" rel="noopener noreferrer"><GitBranch className="size-3 shrink-0" /><span className="truncate">{branch.name}</span></a><span className="shrink-0 font-mono text-[10px] text-muted-foreground">{branch.sha.slice(0, 7)}</span></li>)}</ul>
                : <p className="text-xs text-muted-foreground">No linked branches yet.</p>}
            </div>
          </div>

          {/* Discussion & Activity Section: Clean Tabs adhering to shadcn line variant */}
          <div className="rounded-lg border border-border/70 bg-card/20 p-4 sm:p-5 flex flex-col gap-4">
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
                <form onSubmit={handlePostComment} className="rounded-lg border border-border/70 bg-background/90 p-3 shadow-2xs focus-within:border-ring transition-colors">
                  <div className="flex items-start gap-2.5">
                    <Avatar className="mt-0.5 size-5 shrink-0 rounded-full">
                      <AvatarFallback className="text-xs font-medium bg-secondary text-foreground">G</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        ref={commentInputRef}
                        aria-label="Write a comment"
                        placeholder="Leave a comment or review note..."
                        rows={3}
                        value={commentText}
                        disabled={Boolean(issue.archivedAt)}
                        onChange={(e) => { setCommentText(e.target.value); updateMentionToken(e.target.value, e.target.selectionStart); }}
                        className="min-h-[80px] w-full resize-none border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 leading-relaxed"
                      />
                      {mentionToken && candidatesLoading && <p role="status" className="mt-1 text-xs text-muted-foreground">Loading workspace members…</p>}
                      {mentionToken && candidatesError && <Button type="button" size="xs" variant="ghost" className="mt-1" onClick={() => void refetchCandidates()}>Retry member search</Button>}
                      {mentionToken && !candidatesLoading && !candidatesError && mentionSuggestions.length > 0 && <div role="listbox" aria-label="Mention a workspace member" className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">{mentionSuggestions.map(user => { const handle = user.githubUsername || user.email.split('@')[0]; return <button key={user.id} type="button" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()} onClick={() => insertMention(user)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="font-medium">{user.name}</span><span className="font-mono text-muted-foreground">@{handle}</span></button>; })}</div>}
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!commentText.trim() || commentMutation.isPending}
                      className="px-3 font-medium"
                    >
                      {commentMutation.isPending ? 'Posting...' : 'Comment'}
                    </Button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="space-y-2.5">
                  {commentsLoading && <p role="status" className="text-xs text-muted-foreground">Loading comments…</p>}
                  {commentsError && <div role="alert" className="flex items-center gap-2 text-xs text-destructive">Could not load comments.<Button type="button" size="xs" variant="ghost" onClick={() => void refetchComments()}>Retry</Button></div>}
                  {comments.map(comment => <article key={comment.id} className="rounded-lg border border-border/70 bg-background/60 p-3.5 transition-colors hover:border-border">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2"><Avatar className="size-5 rounded-full"><AvatarFallback className="text-xs bg-secondary text-foreground font-medium">{(comment.authorName || 'G')[0]}</AvatarFallback></Avatar><span className="font-semibold text-foreground text-xs">{comment.authorName || 'Unknown author'}</span><span className="font-mono text-xs text-muted-foreground/70">{formatDateTime(comment.createdAt)}</span>{comment.updatedAt && comment.updatedAt !== comment.createdAt && <span className="text-xs text-muted-foreground">Edited</span>}</div>
                      {comment.canEdit && <div className="flex items-center gap-1"><Button type="button" size="xs" variant="ghost" aria-label={`Edit comment by ${comment.authorName || 'author'}`} onClick={() => { setEditingCommentId(comment.id); setEditCommentBody(comment.body); }}>Edit</Button><Button type="button" size="xs" variant="ghost" aria-label={`Delete comment by ${comment.authorName || 'author'}`} disabled={deleteCommentMutation.isPending} onClick={() => { if (window.confirm('Delete this comment?')) deleteCommentMutation.mutate(comment.id); }}>Delete</Button></div>}
                    </div>
                    {editingCommentId === comment.id ? <form className="flex flex-col gap-2 pl-7" onSubmit={event => { event.preventDefault(); updateCommentMutation.mutate({ id: comment.id, body: editCommentBody }, { onSuccess: () => { setEditingCommentId(null); setEditCommentBody(''); } }); }}><Textarea aria-label="Edit comment" value={editCommentBody} onChange={event => setEditCommentBody(event.target.value)} maxLength={50000} /><div className="flex justify-end gap-2"><Button type="button" size="xs" variant="ghost" onClick={() => setEditingCommentId(null)}>Cancel</Button><Button type="submit" size="xs" disabled={!editCommentBody.trim() || updateCommentMutation.isPending}>{updateCommentMutation.isPending ? 'Saving…' : 'Save'}</Button></div></form> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90 pl-7">{comment.body}</p>}
                  </article>)}
                  {!commentsLoading && !commentsError && comments.length === 0 && <div className="rounded-lg border border-dashed border-border/60 bg-background/40 py-8 text-center text-xs text-muted-foreground">No comments yet. Leave a note or update.</div>}
                </div>
              </TabsContent>

              {/* Activity Tab Content */}
              <TabsContent value="activity" className="mt-0 w-full">
                <div className="space-y-2">
                  {activitiesLoading && <p role="status" className="text-xs text-muted-foreground">Loading activity…</p>}
                  {activitiesError && <div role="alert" className="flex items-center gap-2 text-xs text-destructive">Could not load activity.<Button type="button" size="xs" variant="ghost" onClick={() => void refetchActivities()}>Retry</Button></div>}
                  {activities.map((item) => (
                    <div key={item.id} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
                      <div className="mt-1 size-1.5 shrink-0 rounded-full bg-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <p className="leading-relaxed text-foreground">
                          <span className="font-semibold">{item.actorName || 'System'}</span>{' '}
                          <span className="text-muted-foreground">{formatActivity(item.type, item.metadata)}</span>
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground/60">{formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                  ))}

                  {!activitiesLoading && !activitiesError && activities.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/60 bg-background/40 py-8 text-center text-xs text-muted-foreground">
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
        open={isLinkPrOpen}
        onOpenChange={setIsLinkPrOpen}
      />

      {/* Delete Confirmation Alert Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Delete issue ${issue.identifier}?`}
        description={`This will permanently delete "${issue.title}" and remove all subtasks and activity records.`}
        onConfirm={() => {
          deleteMutation.mutate(issue.id, {
            onSuccess: () => onOpenChange(false),
          });
        }}
      />
    </Sheet>
  );
}
