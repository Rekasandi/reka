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
import { GitBranch, Copy, Check, MessageSquare, Activity, Trash2 } from 'lucide-react';
import { useUpdateIssue, useDeleteIssue } from '../hooks/use-issues';
import { useIssueComments, useCreateComment, useIssueActivities } from '../hooks/use-issue-details';
import { StatusPicker } from './status-picker';
import { PriorityIcon } from './issue-list-view';

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
  const [activeTab, setActiveTab] = React.useState<'comments' | 'activity'>('comments');

  React.useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description || '');
    setCommentText('');
    setActiveTab('comments');
  }, [issue]);

  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const { data: comments = [] } = useIssueComments(issue.id);
  const { data: activities = [] } = useIssueActivities(issue.id);
  const commentMutation = useCreateComment(issue.id);

  const branchName = React.useMemo(() => {
    const slug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36);
    return `feature/${issue.identifier}-${slug}`;
  }, [issue]);

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

  const renderPanel = () => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border/80 bg-background px-5 py-4 pr-12 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-7 shrink-0 rounded-md border border-border bg-card px-2.5 font-mono text-xs font-semibold leading-7 text-foreground">
              {issue.identifier}
            </span>

            <button
              type="button"
              onClick={handleCopyBranch}
              className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11px] font-mono text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Copy Git Branch Name"
            >
              <GitBranch className="size-3" />
              <span className="truncate max-w-[180px]">{branchName}</span>
              {copiedBranch ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive"
            title="Delete issue"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Title</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              spellCheck={false}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-lg font-semibold tracking-[-0.4px] text-foreground outline-hidden transition-colors focus:border-ring"
              placeholder="Issue title"
            />
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 rounded-md border border-border bg-card p-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
              <div className="flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background px-1.5">
                <StatusPicker
                  status={issue.status}
                  className="size-6"
                  onStatusChange={(val) => updateMutation.mutate({ id: issue.id, data: { status: val as any } })}
                />
                <span className="truncate text-xs capitalize text-foreground">{formatStatus(issue.status)}</span>
              </div>
            </div>

            <div className="space-y-1.5 rounded-md border border-border bg-card p-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Priority</p>
              <Select
                value={issue.priority}
                onValueChange={(val) => updateMutation.mutate({ id: issue.id, data: { priority: val as any } })}
              >
                <SelectTrigger className="h-8 w-full rounded-md bg-background text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-1.5">
                          <PriorityIcon priority={opt.value} />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 rounded-md border border-border bg-card p-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
              <div className="flex h-8 items-center">
                <Badge variant="secondary" className="h-7 rounded-full border border-border bg-background px-2.5 font-mono text-[11px] font-medium capitalize">
                  {issue.type}
                </Badge>
              </div>
            </div>

            <div className="space-y-1.5 rounded-md border border-border bg-card p-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Assignee</p>
              <div className="flex h-8 items-center gap-1.5 rounded-md border border-border/70 bg-background px-2">
                <Avatar className="size-4">
                  <AvatarFallback className="text-[9px]">G</AvatarFallback>
                </Avatar>
                <span className="truncate text-xs text-foreground">Gustam</span>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Description</p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              placeholder="Add details, requirements, or links..."
              rows={5}
              className="min-h-[132px] resize-y rounded-md border border-border bg-card text-sm leading-relaxed"
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-3 sm:p-4">
            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as 'comments' | 'activity')}
              className="flex-col gap-3"
            >
              <TabsList variant="line" className="h-9 w-fit justify-start gap-5 p-0">
                <TabsTrigger
                  value="comments"
                  className="h-9 flex-none rounded-none border-0 bg-transparent px-0 py-0 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Comments ({comments.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="h-9 flex-none rounded-none border-0 bg-transparent px-0 py-0 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Activity className="size-3.5" />
                  <span>Activity ({activities.length})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="mt-0 w-full space-y-3">
                <form onSubmit={handlePostComment} className="rounded-md border border-border/80 bg-background p-3">
                  <div className="flex items-start gap-2">
                    <Avatar className="mt-0.5 size-6 shrink-0">
                      <AvatarFallback className="text-[10px]">G</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Textarea
                        placeholder="Write a comment..."
                        rows={3}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="min-h-[84px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button type="submit" size="sm" disabled={!commentText.trim() || commentMutation.isPending}>
                      {commentMutation.isPending ? 'Posting...' : 'Comment'}
                    </Button>
                  </div>
                </form>

                <div className="space-y-2">
                  {comments.map((comment) => (
                    <article key={comment.id} className="rounded-md border border-border/80 bg-background p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{comment.authorName || 'Gustam'}</span>
                        <span className="font-mono">{formatDateTime(comment.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{comment.body}</p>
                    </article>
                  ))}

                  {comments.length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-background py-6 text-center text-sm text-muted-foreground">
                      No comments yet. Leave a note or update.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0 w-full">
                <div className="space-y-2">
                  {activities.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 rounded-md border border-border/80 bg-background p-2.5 text-xs">
                      <div className="mt-1 size-1.5 shrink-0 rounded-full bg-foreground/50" />
                      <div className="min-w-0 flex-1">
                        <p className="leading-relaxed text-foreground">
                          <span className="font-semibold">{item.actorName || 'System'}</span>{' '}
                          <span className="text-muted-foreground">{formatActivity(item.type)}</span>
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                      </div>
                    </div>
                  ))}

                  {activities.length === 0 && (
                    <div className="rounded-md border border-dashed border-border bg-background py-6 text-center text-sm text-muted-foreground">
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
      <SheetContent className="w-full data-[side=right]:sm:max-w-3xl gap-0 border-l border-border bg-background p-0">
        <SheetTitle className="sr-only">Issue {issue.identifier}</SheetTitle>
        <SheetDescription className="sr-only">Issue details and discussion</SheetDescription>
        {renderPanel()}
      </SheetContent>
    </Sheet>
  );
}
