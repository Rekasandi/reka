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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Avatar,
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
  Settings,
} from 'lucide-react';
import { useTeam, useDeleteTeam, useRemoveTeamMember } from '../hooks/use-teams';
import { useIssues } from '../../issues/hooks/use-issues';
import { IssueListView } from '../../issues/components/issue-list-view';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { AddMemberDialog } from './add-member-dialog';
import type { Issue } from '@reka/types';

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = React.useState('issues');
  const [isCreateIssueOpen, setIsCreateIssueOpen] = React.useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isIssueDetailOpen, setIsIssueDetailOpen] = React.useState(false);

  const { data: team, isLoading, isError, refetch } = useTeam(id);
  const { data: allIssues = [] } = useIssues();
  const deleteMutation = useDeleteTeam();
  const removeMemberMutation = useRemoveTeamMember(id || '');

  // Issues belonging to this team
  const teamIssues = React.useMemo(() => {
    return allIssues.filter((i) => i.teamId === id);
  }, [allIssues, id]);

  const handleDelete = () => {
    if (!team) return;
    if (confirm(`Delete team "${team.name}"?`)) {
      deleteMutation.mutate(team.id, {
        onSuccess: () => navigate('/teams'),
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

  if (isError || !team) {
    return (
      <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-6 text-xs text-destructive flex items-center justify-between max-w-3xl mx-auto">
        <span>Failed to load team details.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
          <RefreshCw data-icon="inline-start" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto selection:bg-foreground selection:text-background">
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
      <div className="rounded-[14px] border border-border/80 bg-card/40 p-6 flex flex-col gap-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-[8px] bg-secondary flex items-center justify-center text-foreground font-mono font-bold text-sm shrink-0 border border-border/70 shadow-2xs">
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
            value="issues"
            className="h-8 flex-none rounded-none border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground"
          >
            <CheckSquare className="size-3.5" />
            <span>Issues ({teamIssues.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="h-8 flex-none rounded-none border-0 bg-transparent px-0 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground"
          >
            <Users className="size-3.5" />
            <span>Members ({team.members?.length || 1})</span>
          </TabsTrigger>
        </TabsList>

        {/* Issues Tab */}
        <TabsContent value="issues" className="mt-0 w-full space-y-4">
          <IssueListView
            issues={teamIssues}
            onSelectIssue={handleOpenIssueDetail}
          />
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-0 w-full">
          <div className="rounded-[12px] border border-border/80 divide-y divide-border/60 bg-card/30 overflow-hidden">
            {(team.members || []).map((m) => {
              const userName = m.user?.name || 'Gustam';
              const userEmail = m.user?.email || 'owner@rekasandi.com';
              const initial = userName[0] || 'U';

              return (
                <div key={m.userId} className="flex items-center justify-between p-3.5 text-xs hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-7 rounded-full border border-border/70">
                      <AvatarFallback className="text-[10px] font-medium bg-secondary text-foreground">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-foreground text-xs">{userName}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{userEmail}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={m.role === 'lead' ? 'default' : 'secondary'} className="capitalize text-[10px] h-5 px-2">
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
    </div>
  );
}
