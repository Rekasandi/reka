import * as React from 'react';
import { getIssueStatusCategory, type Issue } from '@reka/types';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Input,
  Field,
  FieldLabel,
  FieldGroup,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  Skeleton,
  Alert,
  AlertDescription,
  AvatarImage,
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
  MessageSquare,
  Activity,
  Trash2,
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
  ArrowLeft,
  ArrowUpRight,
  ChevronRight,
  MoreHorizontal,
  Link as LinkIcon,
  X,
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
import { useTeam, useTeamWorkflowStates } from '../../teams/hooks/use-teams';
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

export function IssueDetailSheet({ issue, open, onOpenChange, ...favorites }: IssueDetailSheetProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  React.useEffect(() => {
    if (!isMobile || !open || !issue) return;
    const search = new URLSearchParams(location.search);
    search.delete('issueId');
    const returnTo = location.pathname + (search.size ? `?${search}` : '');
    onOpenChange(false);
    navigate(`/issues/${issue.id}`, { state: { returnTo } });
  }, [isMobile, open, issue?.id]);
  if (!issue || !open || isMobile) return null;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent showCloseButton={false} className="data-[side=right]:w-full data-[side=right]:sm:max-w-3xl gap-0 p-0">
      <SheetTitle className="sr-only">Issue {issue.identifier}</SheetTitle>
      <SheetDescription className="sr-only">Issue details and discussion</SheetDescription>
      <IssueDetailContent key={issue.id} issue={issue} onClose={() => onOpenChange(false)} {...favorites} />
    </SheetContent>
  </Sheet>;
}

function DetailSection({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return <Collapsible className="order-1 min-w-0 border-t border-border pt-3">
    <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="group w-full justify-start"><ChevronRight className="transition-transform group-data-[state=open]:rotate-90" /><span>{title}</span></Button></CollapsibleTrigger>
    <CollapsibleContent className="pt-3 pb-5">{children}</CollapsibleContent>
  </Collapsible>;
}

function PendingRows({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="flex flex-col gap-2 py-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>;
}

function LoadError({ label, retry }: { label: string; retry: () => void }) {
  return <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-2">Could not load {label}.<Button type="button" variant="outline" size="xs" onClick={retry}>Retry</Button></AlertDescription></Alert>;
}

type IssueDetailContentProps = Omit<IssueDetailSheetProps, 'issue' | 'open' | 'onOpenChange'> & {
  issue: Issue;
  presentation?: 'sheet' | 'page';
  onClose: () => void;
};

export function IssueDetailContent({ issue, presentation = 'sheet', onClose, isFavorite = false, canFavorite = true, onToggleFavorite }: IssueDetailContentProps) {
  const location = useLocation();
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
  const [deleteTarget, setDeleteTarget] = React.useState<{ title: string; confirm: () => void } | null>(null);
  const currentUser = useAuthStore(state => state.user);
  const { data: team } = useTeam(issue.teamId);
  const canEdit = !!currentUser && !['guest', 'client'].includes(currentUser.role) && team?.canWrite !== false;
  const readOnly = !canEdit || !!issue.archivedAt;

  React.useEffect(() => { setTitle(issue.title); }, [issue.title]);
  React.useEffect(() => { setDescription(issue.description || ''); }, [issue.description]);
  React.useEffect(() => { setEstimate(issue.estimate == null ? '' : String(issue.estimate)); }, [issue.estimate]);
  React.useEffect(() => { setDueDate(issue.dueDate ? new Date(issue.dueDate).toISOString().slice(0, 10) : ''); }, [issue.dueDate]);
  React.useEffect(() => {
    setRelationTargetId('');
    setCommentText('');
    setMentionToken(null);
    setEditingCommentId(null);
    setEditCommentBody('');
    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
    setIsLinkPrOpen(false);
    setDeleteTarget(null);
    setActiveTab('comments');
  }, [issue.id]);

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
  const { data: subtasks = [], isLoading: subtasksLoading, isError: subtasksError, refetch: refetchSubtasks } = useSubtasks(issue.id);
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
    if (!nextTitle) { setTitle(issue.title); toast.error('Issue title cannot be empty'); return; }
    if (nextTitle === issue.title) return;
    updateMutation.mutate({ id: issue.id, data: { title: nextTitle } });
  };

  const handleSaveDescription = () => {
    const current = (issue.description || '').trim();
    const next = description.trim();
    if (next === current) return;
    updateMutation.mutate({ id: issue.id, data: { description: next } });
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
    <div data-issue-detail={presentation} className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {presentation === 'page' && <Button type="button" variant="ghost" size="icon-sm" aria-label="Back to issues" onClick={onClose}><ArrowLeft /></Button>}
          <span className="truncate font-mono text-xs text-muted-foreground">{issue.identifier}</span>
          {issue.archivedAt && <Badge variant="secondary">Archived</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={subscriptionError ? 'Retry follow status' : subscription?.subscribed ? 'Unfollow issue' : 'Follow issue'} title={subscription?.subscribed ? 'Unfollow issue' : 'Follow issue'} disabled={subscriptionLoading || subscriptionMutation.isPending} onClick={() => subscriptionError ? void refetchSubscription() : subscriptionMutation.mutate(!subscription?.subscribed)}><Bell className={subscription?.subscribed ? 'fill-current' : ''} /></Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={isFavorite ? 'Remove issue from favorites' : 'Add issue to favorites'} title="Favorite" disabled={!canFavorite || !onToggleFavorite} onClick={onToggleFavorite}><Star className={isFavorite ? 'fill-current' : ''} /></Button>
          {presentation === 'sheet' && <Button variant="ghost" size="icon-sm" asChild><Link to={`/issues/${issue.id}`} state={{ returnTo: location.pathname + location.search }} aria-label="Open full page" title="Open full page"><ArrowUpRight /></Link></Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="Issue actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => { void navigator.clipboard.writeText(`${window.location.origin}/issues/${issue.id}`).then(() => toast.success('Issue link copied')).catch(() => toast.error('Could not copy link')); }}><LinkIcon />Copy issue link</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleCopyBranch}><GitBranch />{copiedBranch ? 'Copied branch name' : 'Copy branch name'}</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleCopyCommand}><Terminal />{copiedCommand ? 'Copied command' : 'Copy git command'}</DropdownMenuItem>
                {issue.githubIssueUrl && <DropdownMenuItem asChild><a href={issue.githubIssueUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />Open GitHub issue</a></DropdownMenuItem>}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem disabled={!canEdit || archiveMutation.isPending} onSelect={() => archiveMutation.mutate({ id: issue.id, restore: !!issue.archivedAt }, { onSuccess: onClose })}>{issue.archivedAt ? <RotateCcw /> : <Archive />}{issue.archivedAt ? 'Restore issue' : 'Archive issue'}</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" disabled={!canEdit} onSelect={handleDelete}><Trash2 />Delete issue</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {presentation === 'sheet' && <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}><X /></Button>}
        </div>
      </header>

      {/* Main Content Area */}
      <div className={presentation === 'sheet' ? 'min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8' : 'px-1 py-6 sm:px-6 sm:py-8'}>
        <div className={presentation === 'page' ? 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-x-12 gap-y-7 lg:grid-cols-[minmax(0,1fr)_260px] [&>*:not(.issue-properties)]:min-w-0 [&>*:not(.issue-properties)]:lg:col-start-1' : 'mx-auto flex w-full max-w-2xl flex-col gap-6'}>
          {/* Title: Geist display style with tight negative tracking, borderless default */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="sr-only">{issue.title}</h1>
            <Textarea
              aria-label="Issue title"
              readOnly={readOnly}
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              spellCheck={false}
              className="issue-detail-title min-h-0 resize-none rounded-none border-0 px-0 py-0 shadow-none focus-visible:ring-1"
              placeholder="Issue title"
            />
          </div>

          {/* Properties are moved to a side column on the full page. */}
          <aside aria-label="Issue properties" className={presentation === 'page' ? 'issue-properties min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-6 lg:border-l lg:border-border lg:pl-8' : 'min-w-0'}>
          <h2 className="mb-4 text-sm font-medium">Properties</h2>
          <fieldset disabled={readOnly} className="issue-detail-properties min-w-0">
          <FieldGroup className={presentation === 'page' ? 'grid grid-cols-2 gap-3 lg:grid-cols-1' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
            <Field><FieldLabel htmlFor="detail-status">Status</FieldLabel>
              <StatusPicker id="detail-status" teamId={issue.teamId} status={issue.status} appearance="badge" onStatusChange={status => updateMutation.mutate({ id: issue.id, data: { status } })} />
            </Field>
            <Field><FieldLabel htmlFor="detail-priority">Priority</FieldLabel>
              <PriorityPicker id="detail-priority" priority={issue.priority} appearance="badge" className="h-8 w-full justify-start" onPriorityChange={priority => updateMutation.mutate({ id: issue.id, data: { priority: priority as Issue['priority'] } })} />
            </Field>
            <Field><FieldLabel htmlFor="detail-assignee">Assignee</FieldLabel>
              <AssigneePicker id="detail-assignee" assigneeId={issue.assigneeId} onAssigneeChange={assigneeId => updateMutation.mutate({ id: issue.id, data: { assigneeId } })} />
            </Field>
            <Field><FieldLabel htmlFor="detail-project">Project</FieldLabel>
              <ProjectPicker id="detail-project" projectId={issue.projectId ?? null} identifier={issue.identifier} className="h-8 w-full justify-start" onProjectChange={projectId => updateMutation.mutate({ id: issue.id, data: { projectId } })} />
            </Field>
            <Field><FieldLabel htmlFor="detail-cycle">Cycle</FieldLabel>
              <CyclePicker id="detail-cycle" cycleId={issue.cycleId ?? null} teamId={issue.teamId} identifier={issue.identifier} className="h-8 w-full justify-start" onCycleChange={cycleId => updateMutation.mutate({ id: issue.id, data: { cycleId } })} />
            </Field>
            <Field><FieldLabel htmlFor="detail-type">Type</FieldLabel>
              <IssueTypePicker id="detail-type" type={issue.type} identifier={issue.identifier} className="h-8 w-full justify-start" onTypeChange={type => updateMutation.mutate({ id: issue.id, data: { type } })} />
            </Field>
            <Field><FieldLabel htmlFor="issue-estimate">Estimate</FieldLabel>
              <Input id="issue-estimate" type="number" min={0} max={100} step={1} value={estimate} onChange={event => setEstimate(event.target.value)} onBlur={handleSaveEstimate} aria-label="Issue estimate" />
            </Field>
            <Field><FieldLabel htmlFor="issue-due-date">Due date</FieldLabel>
              <Input id="issue-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} onBlur={handleSaveDueDate} aria-label="Issue due date" />
            </Field>
          </FieldGroup>
          <div className="mt-4"><IssueLabelsPicker teamId={issue.teamId} projectId={issue.projectId} value={(issue.labels || []).map((label) => label.id)} onChange={(labelIds) => updateMutation.mutate({ id: issue.id, data: { labelIds } })} /></div>
          </fieldset>
          </aside>

          {/* Description Section */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="issue-description" className="text-xs text-muted-foreground">Description</label>
            <Textarea
              id="issue-description"
              readOnly={readOnly}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              placeholder="Add description, acceptance criteria, or context..."
              rows={5}
              className="min-h-32 resize-y leading-relaxed"
            />
          </div>

          <DetailSection title={`Attachments (${attachments.length})`}>
          <section aria-label="Issue attachments" className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Paperclip className="size-3.5 text-muted-foreground" /><span className="text-xs font-medium">Attachments</span><Badge variant="outline">{attachments.length}</Badge></div><div className="flex items-center gap-2"><input ref={attachmentInputRef} type="file" aria-label="Choose issue attachment" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/markdown" className="sr-only" onChange={handleUploadAttachment} /><Button type="button" size="xs" variant="outline" disabled={attachmentMutations.upload.isPending || readOnly} onClick={() => attachmentInputRef.current?.click()}>{attachmentMutations.upload.isPending ? 'Uploading…' : 'Upload file'}</Button></div></div>
            <p className="text-xs text-muted-foreground">PNG, JPEG, GIF, WebP, PDF or UTF-8 text · up to 5 MiB. Files are private to people who can read this issue.</p>
            {attachmentsLoading && <p role="status" className="text-xs text-muted-foreground">Loading attachments…</p>}
            {attachmentsError && <div role="alert" className="flex items-center gap-2 text-xs text-destructive">Could not load attachments.<Button type="button" size="xs" variant="ghost" onClick={() => void refetchAttachments()}>Retry</Button></div>}
            {!attachmentsLoading && !attachmentsError && attachments.length === 0 && <p className="text-xs text-muted-foreground">No attachments yet.</p>}
            {attachments.map(file => <div key={file.id} className="flex min-w-0 items-center gap-2 border-t border-border/50 pt-2 text-xs"><Paperclip className="size-3 shrink-0 text-muted-foreground" /><a className="min-w-0 flex-1 truncate hover:underline" href={file.url} download={file.fileName} aria-label={`Download ${file.fileName}`}>{file.fileName}</a><span className="shrink-0 text-muted-foreground">{Math.max(1, Math.ceil(file.fileSize / 1024))} KB</span>{file.canDelete && <Button type="button" variant="ghost" size="icon-xs" aria-label={`Delete attachment ${file.fileName}`} disabled={attachmentMutations.remove.isPending} onClick={() => setDeleteTarget({ title: `Delete ${file.fileName}?`, confirm: () => attachmentMutations.remove.mutate(file.id) })}><Trash2 className="size-3" /></Button>}</div>)}
          </section>
          </DetailSection>

          <DetailSection title={`Relations (${relations.length})`}>
          <section aria-label="Issue relations" className="flex min-w-0 flex-col gap-3">
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
              <Select disabled={readOnly} value={relationType} onValueChange={value => setRelationType(value as typeof relationType)}>
                <SelectTrigger id="issue-relation-type" aria-label="Relation type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="blocks">Blocks</SelectItem><SelectItem value="blocked_by">Blocked by</SelectItem><SelectItem value="related_to">Related to</SelectItem><SelectItem value="duplicate">Duplicate of</SelectItem></SelectGroup></SelectContent>
              </Select>
              <Select disabled={readOnly} value={relationTargetId} onValueChange={setRelationTargetId}>
                <SelectTrigger id="issue-relation-target" aria-label="Related issue" className="min-w-0 flex-1"><SelectValue placeholder="Select same-team issue…" /></SelectTrigger>
                <SelectContent><SelectGroup>{visibleIssues.filter(candidate => candidate.teamId === issue.teamId && candidate.id !== issue.id).map(candidate => <SelectItem key={candidate.id} value={candidate.id}>{candidate.identifier} - {candidate.title}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
              <Button type="button" size="sm" disabled={readOnly || !relationTargetId || relationMutations.add.isPending} onClick={() => relationMutations.add.mutate({ relatedIssueId: relationTargetId, type: relationType }, { onSuccess: () => setRelationTargetId('') })}>Add relation</Button>
            </div>
          </section>
          </DetailSection>

          <DetailSection title="Recurrence"><IssueRecurrenceSection issueId={issue.id} archived={readOnly} /></DetailSection>

          {/* Sub-tasks Section: Linear style sub-issue tracker */}
          <section aria-label="Sub-tasks" className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">Sub-tasks</h2>
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
                  disabled={readOnly}
                  onClick={() => setIsAddingSubtask(true)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3" />
                  <span>Add sub-task</span>
                </Button>
              )}
            </div>

            {subtasksLoading && <PendingRows label="Loading sub-tasks" />}
            {subtasksError && <LoadError label="sub-tasks" retry={() => void refetchSubtasks()} />}
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
                        <Button
                          type="button" variant="ghost" size="icon-xs"
                          disabled={readOnly || updateMutation.isPending}
                          onClick={() => handleToggleSubtask(st)}
                          aria-label={`${isDone ? 'Reopen' : 'Complete'} ${st.identifier}`}
                          title={isDone ? 'Mark as todo' : 'Mark as done'}
                        >
                          <CheckCircle2
                            className={`size-4 transition-colors ${
                              isDone ? 'text-primary fill-primary/20' : 'text-muted-foreground/50 hover:text-muted-foreground'
                            }`}
                          />
                        </Button>
                        <span className="font-mono text-xs text-muted-foreground font-semibold shrink-0">
                          {st.identifier}
                        </span>
                        <Link to={`/issues/${st.id}`} className={`min-w-0 truncate text-xs hover:underline ${isDone ? 'line-through text-muted-foreground' : 'text-foreground font-medium'}`}>{st.title}</Link>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityIcon priority={st.priority} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={readOnly || deleteMutation.isPending}
                          onClick={() => setDeleteTarget({ title: `Delete sub-task ${st.identifier}?`, confirm: () => deleteMutation.mutate(st.id) })}
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
                <Input
                  aria-label="Sub-task title"
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

            {!subtasksLoading && !subtasksError && subtasks.length === 0 && !isAddingSubtask && (
              <p className="py-1 text-xs text-muted-foreground">
                No sub-tasks yet. Break this issue down into smaller steps.
              </p>
            )}
          </section>

          <DetailSection title={`GitHub (${pullRequests.length} pull requests)`}>
          <div className="flex min-w-0 flex-col gap-3">
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
                disabled={readOnly}
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
              <div className="flex flex-col gap-1 py-2 text-xs text-muted-foreground">
                <span>No pull request linked yet.</span>
                <span className="font-mono text-xs text-muted-foreground/80">Links update when GitHub events arrive.</span>
              </div>
            )}

            <div className="border-t border-border/50 pt-3 flex flex-col gap-2">
              <span className="text-xs font-medium text-foreground">Linked branches</span>
              {branchesLoading ? <p role="status" className="text-xs text-muted-foreground">Loading branches…</p>
                : branchesError ? <div className="flex items-center justify-between gap-2 text-xs text-destructive"><span>Could not load branches.</span><Button type="button" size="xs" variant="outline" onClick={() => void refetchBranches()}>Retry</Button></div>
                : linkedBranches.length ? <ul className="flex flex-col gap-1.5">{linkedBranches.map(branch => <li key={branch.id} className="flex min-w-0 items-center justify-between gap-2 text-xs"><a className="flex min-w-0 items-center gap-2 truncate text-muted-foreground hover:text-foreground hover:underline" href={`https://github.com/${branch.repositoryName}/tree/${encodeURIComponent(branch.name)}`} target="_blank" rel="noopener noreferrer"><GitBranch className="size-3 shrink-0" /><span className="truncate">{branch.name}</span></a><span className="shrink-0 font-mono text-[10px] text-muted-foreground">{branch.sha.slice(0, 7)}</span></li>)}</ul>
                : <p className="text-xs text-muted-foreground">No linked branches yet.</p>}
            </div>
          </div>

          </DetailSection>

          <section aria-label="Discussion" className="flex min-w-0 flex-col gap-4 border-t border-border pt-5">
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
              <TabsContent value="comments" className="mt-0 flex w-full flex-col gap-5">
                {/* New Comment Box */}
                <form onSubmit={handlePostComment} className="rounded-lg border border-border/70 bg-background/90 p-3 shadow-2xs focus-within:border-ring transition-colors">
                  <div className="flex items-start gap-2.5">
                    <Avatar className="mt-0.5 size-5 shrink-0 rounded-full">
                      {currentUser?.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />}<AvatarFallback>{currentUser?.name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        ref={commentInputRef}
                        aria-label="Write a comment"
                        placeholder="Leave a comment or review note..."
                        rows={3}
                        value={commentText}
                        disabled={readOnly}
                        onChange={(e) => { setCommentText(e.target.value); updateMentionToken(e.target.value, e.target.selectionStart); }}
                        className="min-h-[80px] w-full resize-none border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60 leading-relaxed"
                      />
                      {mentionToken && candidatesLoading && <p role="status" className="mt-1 text-xs text-muted-foreground">Loading workspace members…</p>}
                      {mentionToken && candidatesError && <Button type="button" size="xs" variant="ghost" className="mt-1" onClick={() => void refetchCandidates()}>Retry member search</Button>}
                      {mentionToken && !candidatesLoading && !candidatesError && mentionSuggestions.length > 0 && <div role="listbox" aria-label="Mention a workspace member" className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">{mentionSuggestions.map(user => { const handle = user.githubUsername || user.email.split('@')[0]; return <Button key={user.id} variant="ghost" type="button" role="option" aria-selected="false" onMouseDown={event => event.preventDefault()} onClick={() => insertMention(user)} className="w-full justify-start"><span>{user.name}</span><span className="font-mono text-muted-foreground">@{handle}</span></Button>; })}</div>}
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-border/40 flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={readOnly || !commentText.trim() || commentMutation.isPending}
                      className="px-3 font-medium"
                    >
                      {commentMutation.isPending ? 'Posting...' : 'Comment'}
                    </Button>
                  </div>
                </form>

                {/* Comments List */}
                <div className="flex flex-col gap-5">
                  {commentsLoading && <PendingRows label="Loading comments" />}
                  {commentsError && <LoadError label="comments" retry={() => void refetchComments()} />}
                  {comments.map(comment => <article key={comment.id} className="min-w-0 py-2">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2"><Avatar className="size-5 rounded-full"><AvatarFallback className="text-xs bg-secondary text-foreground font-medium">{(comment.authorName || '?')[0]}</AvatarFallback></Avatar><span className="font-semibold text-foreground text-xs">{comment.authorName || 'Unknown author'}</span><span className="font-mono text-xs text-muted-foreground/70">{formatDateTime(comment.createdAt)}</span>{comment.updatedAt && comment.updatedAt !== comment.createdAt && <span className="text-xs text-muted-foreground">Edited</span>}</div>
                      {comment.canEdit && <div className="flex items-center gap-1"><Button type="button" size="xs" variant="ghost" aria-label={`Edit comment by ${comment.authorName || 'author'}`} onClick={() => { setEditingCommentId(comment.id); setEditCommentBody(comment.body); }}>Edit</Button><Button type="button" size="xs" variant="ghost" aria-label={`Delete comment by ${comment.authorName || 'author'}`} disabled={deleteCommentMutation.isPending} onClick={() => setDeleteTarget({ title: 'Delete this comment?', confirm: () => deleteCommentMutation.mutate(comment.id) })}>Delete</Button></div>}
                    </div>
                    {editingCommentId === comment.id ? <form className="flex flex-col gap-2 pl-7" onSubmit={event => { event.preventDefault(); updateCommentMutation.mutate({ id: comment.id, body: editCommentBody }, { onSuccess: () => { setEditingCommentId(null); setEditCommentBody(''); } }); }}><Textarea aria-label="Edit comment" value={editCommentBody} onChange={event => setEditCommentBody(event.target.value)} maxLength={50000} /><div className="flex justify-end gap-2"><Button type="button" size="xs" variant="ghost" onClick={() => setEditingCommentId(null)}>Cancel</Button><Button type="submit" size="xs" disabled={!editCommentBody.trim() || updateCommentMutation.isPending}>{updateCommentMutation.isPending ? 'Saving…' : 'Save'}</Button></div></form> : <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90 pl-7">{comment.body}</p>}
                  </article>)}
                  {!commentsLoading && !commentsError && comments.length === 0 && <p className="py-2 text-sm text-muted-foreground">No comments yet.</p>}
                </div>
              </TabsContent>

              {/* Activity Tab Content */}
              <TabsContent value="activity" className="mt-0 w-full">
                <div className="flex flex-col gap-2">
                  {activitiesLoading && <PendingRows label="Loading activity" />}
                  {activitiesError && <LoadError label="activity" retry={() => void refetchActivities()} />}
                  {activities.map((item) => (
                    <div key={item.id} className="flex items-start gap-2.5 py-3 text-xs">
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
                    <div className="py-4 text-sm text-muted-foreground">
                      No activity recorded yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderPanel()}

      {/* Link PR Dialog */}
      <LinkPullRequestDialog
        issueId={issue.id}
        issueIdentifier={issue.identifier}
        open={isLinkPrOpen}
        onOpenChange={setIsLinkPrOpen}
      />

      <ConfirmDeleteDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }} title={deleteTarget?.title ?? 'Delete item?'} onConfirm={() => deleteTarget?.confirm()} />

      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Delete issue ${issue.identifier}?`}
        description={`This will permanently delete "${issue.title}" and remove all subtasks and activity records.`}
        onConfirm={() => {
          deleteMutation.mutate(issue.id, {
            onSuccess: onClose,
          });
        }}
      />
    </>
  );
}
