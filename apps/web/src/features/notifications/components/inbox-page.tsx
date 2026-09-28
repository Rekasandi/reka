import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
  Textarea,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Skeleton,
  toast,
} from '@reka/ui';
import {
  Inbox as InboxIcon,
  Bell,
  CheckCheck,
  Archive,
  Trash2,
  GitPullRequest,
  AtSign,
  UserPlus,
  MessageSquare,
  Clock,
  ArrowRightCircle,
  AlertCircle,
  Check,
  Search,
  MoreHorizontal,
  Sparkles,
  Send,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Notification, NotificationType, Issue } from '@reka/types';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useClearRead,
  useDeleteNotification,
  useSeedDemoNotifications,
  useCreateNotification,
} from '../hooks/use-notifications';
import { useIssues } from '../../issues/hooks/use-issues';
import { useCreateComment } from '../../issues/hooks/use-issue-details';
import { getIssueByIdentifier } from '../../issues/api/issues.api';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { StatusPicker } from '../../issues/components/status-picker';
import { PriorityIcon } from '../../issues/components/issue-list-view';

type FilterTab = 'all' | 'unread' | 'mentions' | 'assignments' | 'pr' | 'updates';

export function InboxPage() {
  const [activeTab, setActiveTab] = React.useState<FilterTab>('unread');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState('');
  const [isSubmittingReply, setIsSubmittingReply] = React.useState(false);

  // Issue detail sheet integration
  const [inspectingIssue, setInspectingIssue] = React.useState<Issue | null>(null);
  const [isIssueSheetOpen, setIsIssueSheetOpen] = React.useState(false);

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Notifications API hooks
  const { data: notifications = [], isLoading, refetch } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const clearReadMutation = useClearRead();
  const deleteMutation = useDeleteNotification();
  const seedDemoMutation = useSeedDemoNotifications();
  const createNotificationMutation = useCreateNotification();

  // Issues cache
  const { data: issues = [] } = useIssues();

  // Filtered notifications
  const filteredNotifications = React.useMemo(() => {
    let list = notifications;

    // Filter by tab
    if (activeTab === 'unread') {
      list = list.filter((n) => !n.read);
    } else if (activeTab === 'mentions') {
      list = list.filter((n) => n.type === 'mention');
    } else if (activeTab === 'assignments') {
      list = list.filter((n) => n.type === 'assignment');
    } else if (activeTab === 'pr') {
      list = list.filter(
        (n) =>
          n.type === 'pr_review_requested' ||
          n.type === 'pr_approved' ||
          n.type === 'pr_merged',
      );
    } else if (activeTab === 'updates') {
      list = list.filter(
        (n) =>
          n.type === 'status_change' ||
          n.type === 'deadline_approaching' ||
          n.type === 'issue_blocked',
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          (n.metadata?.issueIdentifier &&
            String(n.metadata.issueIdentifier).toLowerCase().includes(q)),
      );
    }

    return list;
  }, [notifications, activeTab, searchQuery]);

  // Selected notification object
  const selectedNotification = React.useMemo(() => {
    if (!filteredNotifications.length) return null;
    if (selectedId) {
      const found = filteredNotifications.find((n) => n.id === selectedId);
      if (found) return found;
    }
    return filteredNotifications[0];
  }, [filteredNotifications, selectedId]);

  // Keep selectedId in sync
  React.useEffect(() => {
    if (selectedNotification && selectedId !== selectedNotification.id) {
      setSelectedId(selectedNotification.id);
    }
  }, [selectedNotification, selectedId]);

  // Linked issue resolution for selected notification
  const linkedIssueIdentifier = selectedNotification?.metadata?.issueIdentifier;
  const linkedIssue = React.useMemo(() => {
    if (!linkedIssueIdentifier) return null;
    return (
      issues.find(
        (i) => i.identifier.toUpperCase() === String(linkedIssueIdentifier).toUpperCase(),
      ) || null
    );
  }, [issues, linkedIssueIdentifier]);

  // Quick reply comment mutation
  const commentMutation = useCreateComment(linkedIssue?.id);

  // Handle open issue sheet
  const handleOpenIssue = async () => {
    if (linkedIssue) {
      setInspectingIssue(linkedIssue);
      setIsIssueSheetOpen(true);
      return;
    }

    if (linkedIssueIdentifier) {
      try {
        const fetched = await getIssueByIdentifier(String(linkedIssueIdentifier));
        setInspectingIssue(fetched);
        setIsIssueSheetOpen(true);
      } catch {
        toast.error(`Could not load issue ${linkedIssueIdentifier}`);
      }
    }
  };

  // Handle quick reply
  const handleSendReply = async () => {
    if (!replyText.trim() || !linkedIssue?.id) return;
    try {
      setIsSubmittingReply(true);
      await commentMutation.mutateAsync(replyText.trim());
      setReplyText('');
      toast.success('Reply added to issue');

      // Auto mark notification as read after replying
      if (selectedNotification && !selectedNotification.read) {
        markAsReadMutation.mutate({ id: selectedNotification.id, read: true });
      }
    } catch (err: any) {
      toast.error('Failed to post reply', { description: err.message });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Keyboard navigation & shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input / textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (!filteredNotifications.length) return;

      const currentIndex = filteredNotifications.findIndex(
        (n) => n.id === selectedNotification?.id,
      );

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, filteredNotifications.length - 1);
        setSelectedId(filteredNotifications[nextIndex].id);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        setSelectedId(filteredNotifications[prevIndex].id);
      } else if (e.key === 'e' || e.key === 'r') {
        if (selectedNotification) {
          e.preventDefault();
          markAsReadMutation.mutate({
            id: selectedNotification.id,
            read: !selectedNotification.read,
          });
        }
      } else if (e.key === 'u') {
        if (selectedNotification && selectedNotification.read) {
          e.preventDefault();
          markAsReadMutation.mutate({
            id: selectedNotification.id,
            read: false,
          });
        }
      } else if (e.key === 'Delete' || e.key === 'x') {
        if (selectedNotification) {
          e.preventDefault();
          deleteMutation.mutate(selectedNotification.id);
        }
      } else if (e.key === 'Enter') {
        if (linkedIssueIdentifier) {
          e.preventDefault();
          void handleOpenIssue();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredNotifications, selectedNotification, linkedIssueIdentifier]);

  // Counts for tabs
  const unreadCount = unreadData?.count ?? notifications.filter((n) => !n.read).length;
  const mentionsCount = notifications.filter((n) => n.type === 'mention').length;
  const assignmentsCount = notifications.filter((n) => n.type === 'assignment').length;
  const prCount = notifications.filter(
    (n) =>
      n.type === 'pr_review_requested' ||
      n.type === 'pr_approved' ||
      n.type === 'pr_merged',
  ).length;

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'unread', label: 'Unread', count: unreadCount },
    { id: 'all', label: 'All', count: notifications.length },
    { id: 'mentions', label: 'Mentions', count: mentionsCount },
    { id: 'assignments', label: 'Assignments', count: assignmentsCount },
    { id: 'pr', label: 'PRs & Git', count: prCount },
    { id: 'updates', label: 'Updates' },
  ];

  // Helper for notification type icons & badges
  const getTypeMeta = (type: NotificationType | string) => {
    switch (type) {
      case 'pr_merged':
        return {
          icon: GitPullRequest,
          label: 'PR Merged',
          color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
          badgeVariant: 'secondary' as const,
        };
      case 'pr_review_requested':
        return {
          icon: GitPullRequest,
          label: 'Review Requested',
          color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
          badgeVariant: 'outline' as const,
        };
      case 'pr_approved':
        return {
          icon: GitPullRequest,
          label: 'PR Approved',
          color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          badgeVariant: 'outline' as const,
        };
      case 'mention':
        return {
          icon: AtSign,
          label: 'Mention',
          color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
          badgeVariant: 'outline' as const,
        };
      case 'assignment':
        return {
          icon: UserPlus,
          label: 'Assignment',
          color: 'text-foreground bg-primary/10 border-primary/20',
          badgeVariant: 'secondary' as const,
        };
      case 'comment':
        return {
          icon: MessageSquare,
          label: 'Comment',
          color: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20',
          badgeVariant: 'outline' as const,
        };
      case 'status_change':
        return {
          icon: ArrowRightCircle,
          label: 'Status Change',
          color: 'text-muted-foreground bg-muted border-border',
          badgeVariant: 'outline' as const,
        };
      case 'deadline_approaching':
        return {
          icon: AlertCircle,
          label: 'Deadline',
          color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
          badgeVariant: 'destructive' as const,
        };
      default:
        return {
          icon: Bell,
          label: 'Notification',
          color: 'text-muted-foreground bg-muted border-border',
          badgeVariant: 'outline' as const,
        };
    }
  };

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full h-[calc(100vh-6rem)] selection:bg-foreground selection:text-background pb-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Inbox</h1>
            {unreadCount > 0 && (
              <span className="flex items-center justify-center px-1.5 py-0.5 text-xs font-mono font-medium rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Triage review requests, mentions, assignments, and GitHub pull request updates.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Filter inbox... (/)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>

          {/* Mark all as read */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
            title="Mark all notifications as read"
          >
            <CheckCheck className="size-3.5" />
            <span className="hidden sm:inline">Mark all read</span>
          </Button>

          {/* More Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Inbox actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs">
              <DropdownMenuItem
                onClick={() => clearReadMutation.mutate()}
                disabled={clearReadMutation.isPending}
                className="gap-2 cursor-pointer"
              >
                <Archive className="size-3.5 text-muted-foreground" />
                <span>Clear read notifications</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => seedDemoMutation.mutate()}
                disabled={seedDemoMutation.isPending}
                className="gap-2 cursor-pointer"
              >
                <Sparkles className="size-3.5 text-blue-500" />
                <span>Generate demo triage items</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  createNotificationMutation.mutate({
                    type: 'mention',
                    title: 'Alex Morgan mentioned you on RS-104',
                    body: '@gustam Can you check if the optimistic triage shortcuts feel fast?',
                    link: '/issues',
                    metadata: { issueIdentifier: 'RS-104', authorName: 'Alex Morgan' },
                  })
                }
                className="gap-2 cursor-pointer"
              >
                <AtSign className="size-3.5 text-blue-500" />
                <span>Simulate incoming mention</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  createNotificationMutation.mutate({
                    type: 'pr_merged',
                    title: 'PR #182 Merged: Enhance issue query pagination',
                    body: 'Pull request #182 was merged by Gustam. Linked issue RS-88 moved to Done.',
                    link: '/issues',
                    metadata: {
                      issueIdentifier: 'RS-88',
                      prNumber: 182,
                      prTitle: 'Enhance issue query pagination',
                      state: 'merged',
                    },
                  })
                }
                className="gap-2 cursor-pointer"
              >
                <GitPullRequest className="size-3.5 text-purple-500" />
                <span>Simulate PR merged event</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 shrink-0 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                isActive
                  ? 'bg-foreground text-background shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-xs font-mono px-1 rounded-full ${
                    isActive
                      ? 'bg-background/20 text-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Split Screen Area: Left List + Right Detail */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left Notification List Pane (5 cols on md, 4 cols on lg) */}
        <div className="md:col-span-5 lg:col-span-5 flex flex-col border border-border rounded-lg bg-card overflow-hidden h-full">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/80 bg-muted/30 text-xs font-medium text-muted-foreground">
            <span>
              {filteredNotifications.length} {filteredNotifications.length === 1 ? 'item' : 'items'}
            </span>
            <span className="hidden sm:inline text-xs lowercase text-muted-foreground/80">
              [j/k navigate • e read]
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {isLoading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2.5 items-start">
                    <Skeleton className="size-7 rounded-full shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3 text-muted-foreground">
                <div className="size-10 rounded-full border border-border flex items-center justify-center bg-muted/40 text-muted-foreground">
                  <Check className="size-5 text-emerald-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-foreground">
                    {searchQuery ? 'No matching notifications' : 'All caught up'}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">
                    {searchQuery
                      ? 'Try clearing the search query or changing active filters.'
                      : 'You have no pending triage items in this category.'}
                  </p>
                </div>
                {!searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 mt-2"
                    onClick={() => seedDemoMutation.mutate()}
                    disabled={seedDemoMutation.isPending}
                  >
                    <Sparkles className="size-3 text-blue-500" />
                    <span>Generate sample inbox items</span>
                  </Button>
                )}
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const isSelected = selectedNotification?.id === item.id;
                const meta = getTypeMeta(item.type);
                const Icon = meta.icon;
                const createdAtDate = new Date(item.createdAt);
                const timeAgo = !isNaN(createdAtDate.getTime())
                  ? formatDistanceToNow(createdAtDate, { addSuffix: true })
                  : '';

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`group relative flex items-start gap-2.5 p-3 cursor-pointer transition-colors text-left select-none ${
                      isSelected
                        ? 'bg-muted/80 ring-1 ring-border/80'
                        : 'hover:bg-muted/40'
                    } ${!item.read ? 'bg-background' : 'opacity-85'}`}
                  >
                    {/* Unread indicator dot */}
                    <div className="pt-1 shrink-0">
                      {!item.read ? (
                        <span className="block size-2 rounded-full bg-blue-600 dark:bg-blue-400 ring-2 ring-blue-500/20" />
                      ) : (
                        <span className="block size-2 rounded-full bg-transparent" />
                      )}
                    </div>

                    {/* Icon */}
                    <div
                      className={`size-7 rounded-md border flex items-center justify-center shrink-0 ${meta.color}`}
                    >
                      <Icon className="size-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          {item.metadata?.issueIdentifier && (
                            <span className="text-xs font-mono font-semibold text-foreground/90">
                              {item.metadata.issueIdentifier}
                            </span>
                          )}
                          <span className="text-xs font-medium text-muted-foreground">
                            {meta.label}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground/80 shrink-0 font-mono">
                          {timeAgo}
                        </span>
                      </div>

                      <p
                        className={`text-xs truncate ${
                          !item.read ? 'font-semibold text-foreground' : 'text-foreground/80'
                        }`}
                      >
                        {item.title}
                      </p>

                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {item.body}
                      </p>
                    </div>

                    {/* Hover action shortcuts */}
                    <div className="hidden group-hover:flex items-center gap-1 absolute right-2 top-2 bg-card/90 backdrop-blur-xs p-0.5 rounded-md border border-border shadow-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsReadMutation.mutate({ id: item.id, read: !item.read });
                        }}
                        title={item.read ? 'Mark as unread (u)' : 'Mark as read (e)'}
                        className="p-1 hover:text-foreground text-muted-foreground rounded-sm hover:bg-muted"
                      >
                        <Check className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(item.id);
                        }}
                        title="Delete (x)"
                        className="p-1 hover:text-rose-600 text-muted-foreground rounded-sm hover:bg-muted"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail & Triage Pane (7 cols on md, 7 cols on lg) */}
        <div className="md:col-span-7 lg:col-span-7 flex flex-col border border-border rounded-lg bg-card overflow-hidden h-full">
          {selectedNotification ? (
            <div className="flex flex-col h-full overflow-y-auto">
              {/* Detail Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={getTypeMeta(selectedNotification.type).badgeVariant}
                    className="text-xs font-medium"
                  >
                    {getTypeMeta(selectedNotification.type).label}
                  </Badge>
                  {selectedNotification.metadata?.issueIdentifier && (
                    <span className="text-xs font-mono font-medium text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
                      {selectedNotification.metadata.issueIdentifier}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(selectedNotification.createdAt), 'MMM d, yyyy · HH:mm')}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() =>
                      markAsReadMutation.mutate({
                        id: selectedNotification.id,
                        read: !selectedNotification.read,
                      })
                    }
                  >
                    <Check className="size-3.5" />
                    <span>{selectedNotification.read ? 'Mark unread (u)' : 'Mark read (e)'}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                    onClick={() => deleteMutation.mutate(selectedNotification.id)}
                    title="Delete notification (x)"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Detail Body */}
              <div className="p-5 flex-1 space-y-5 overflow-y-auto">
                <div className="space-y-1.5">
                  <h2 className="text-base font-semibold tracking-tight text-foreground leading-snug">
                    {selectedNotification.title}
                  </h2>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedNotification.body}
                  </p>
                </div>

                {/* Linked Issue Card Preview */}
                {linkedIssueIdentifier && (
                  <Card className="border-border/70 bg-muted/30 hover:bg-muted/50 transition-colors">
                    <CardHeader className="p-3.5 pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-primary">
                            {linkedIssueIdentifier}
                          </span>
                          {linkedIssue && (
                            <span className="text-xs text-foreground font-medium truncate max-w-sm">
                              {linkedIssue.title}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground"
                          onClick={() => void handleOpenIssue()}
                        >
                          <span>Open Issue</span>
                          <ExternalLink className="size-3" />
                        </Button>
                      </div>
                    </CardHeader>
                    {linkedIssue && (
                      <CardContent className="p-3.5 pt-0">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                          <div className="flex items-center gap-1.5">
                            <PriorityIcon priority={linkedIssue.priority} />
                            <span className="capitalize">{linkedIssue.priority.replace('_', ' ')}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-blue-500" />
                            <span className="capitalize">{linkedIssue.status.replace('_', ' ')}</span>
                          </div>
                          {linkedIssue.description && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[260px] text-muted-foreground/80">
                                {linkedIssue.description}
                              </span>
                            </>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Linked GitHub PR Card */}
                {selectedNotification.metadata?.prNumber && (
                  <Card className="border-purple-500/20 bg-purple-500/5">
                    <CardContent className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <GitPullRequest className="size-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-foreground">
                              PR #{selectedNotification.metadata.prNumber}
                            </span>
                            {selectedNotification.metadata?.repo && (
                              <span className="text-xs font-mono text-muted-foreground">
                                {selectedNotification.metadata.repo}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {selectedNotification.metadata.prTitle ||
                              selectedNotification.title}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs bg-background"
                      >
                        {selectedNotification.metadata.state || 'GitHub PR'}
                      </Badge>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Reply / Comment Box if tied to an issue */}
                {linkedIssue && (
                  <div className="pt-2 border-t border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="size-3" />
                        Quick Reply to {linkedIssueIdentifier}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Textarea
                        placeholder="Write a quick comment or response..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[70px] text-xs resize-none bg-background"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            void handleSendReply();
                          }
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">
                          Press ⌘+Enter to submit reply
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => void handleSendReply()}
                          disabled={!replyText.trim() || isSubmittingReply}
                        >
                          <Send className="size-3" />
                          <span>Reply</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Keyboard Shortcuts Helper Footer */}
              <div className="px-5 py-2 border-t border-border bg-muted/30 text-xs font-mono text-muted-foreground flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-foreground font-semibold">
                      j
                    </kbd>{' '}
                    /
                    <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-foreground font-semibold ml-1">
                      k
                    </kbd>{' '}
                    navigate
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-foreground font-semibold">
                      e
                    </kbd>{' '}
                    toggle read
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-foreground font-semibold">
                      x
                    </kbd>{' '}
                    delete
                  </span>
                  {linkedIssueIdentifier && (
                    <span>
                      <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-foreground font-semibold">
                        ↵
                      </kbd>{' '}
                      open issue
                    </span>
                  )}
                </div>
                <span>Linear-grade triage</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground gap-2">
              <InboxIcon className="size-8 text-muted-foreground/40" />
              <p className="text-xs font-medium text-foreground">No item selected</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Select a notification from the list or use <kbd className="px-1 bg-muted rounded border">j</kbd> and <kbd className="px-1 bg-muted rounded border">k</kbd> to triage.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Issue Detail Sheet for seamless triage */}
      <IssueDetailSheet
        issue={inspectingIssue}
        open={isIssueSheetOpen}
        onOpenChange={setIsIssueSheetOpen}
      />
    </div>
  );
}
