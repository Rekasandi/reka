import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  Input,
} from '@reka/ui';
import { GitBranch, Check, Search, Lock, Globe, Plus, ExternalLink } from 'lucide-react';
import { useGithubRepositories } from '../../settings/hooks/use-github-repos';
import { useLinkProjectRepository } from '../hooks/use-project-repos';
import type { ProjectRepository } from '../api/projects.api';
import { AddRepositoryDialog } from '../../settings/components/add-repository-dialog';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface LinkRepositoryDialogProps {
  projectId: string;
  projectName: string;
  linkedRepositories: ProjectRepository[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkRepositoryDialog({
  projectId,
  projectName,
  linkedRepositories,
  open,
  onOpenChange,
}: LinkRepositoryDialogProps) {
  const [search, setSearch] = React.useState('');
  const [isConnectNewOpen, setIsConnectNewOpen] = React.useState(false);

  const { data: workspaceRepos = [], isLoading } = useGithubRepositories();
  const linkMutation = useLinkProjectRepository(projectId);

  const linkedIds = React.useMemo(() => {
    return new Set(linkedRepositories.map((r) => r.id));
  }, [linkedRepositories]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaceRepos;
    return workspaceRepos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q),
    );
  }, [workspaceRepos, search]);

  const handleLink = (repoId: string) => {
    linkMutation.mutate(repoId, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full sm:max-w-lg max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <GithubIcon className="size-4 text-foreground" />
              <DialogTitle className="text-base font-semibold">Connect Repository</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Link a GitHub repository to <span className="font-semibold text-foreground">{projectName}</span> to track pull requests, branches, and automation.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search connected repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/60"
              />
            </div>

            <div className="rounded-lg border border-border/80 divide-y divide-border/60 max-h-[280px] overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Loading repositories...
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {search ? 'No matching repositories found.' : 'No repositories connected in workspace.'}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      setIsConnectNewOpen(true);
                    }}
                    className="h-7 text-xs rounded-[6px] gap-1.5"
                  >
                    <Plus className="size-3" />
                    <span>Connect from GitHub</span>
                  </Button>
                </div>
              ) : (
                filtered.map((repo) => {
                  const isLinked = linkedIds.has(repo.id);

                  return (
                    <div
                      key={repo.id}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <GithubIcon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-foreground truncate">
                              {repo.fullName}
                            </span>
                            {repo.isPrivate ? (
                              <Badge variant="outline" className="text-xs h-4 px-1 gap-0.5 border-border">
                                <Lock className="size-2" />
                                <span>Private</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs h-4 px-1 gap-0.5 border-border">
                                <Globe className="size-2" />
                                <span>Public</span>
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono mt-0.5">
                            <GitBranch className="size-3" />
                            <span>{repo.defaultBranch || 'main'}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {isLinked ? (
                          <Badge variant="secondary" className="text-xs h-6 px-2 gap-1 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20">
                            <Check className="size-2.5" />
                            <span>Linked</span>
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={linkMutation.isPending}
                            onClick={() => handleLink(repo.id)}
                            className="h-7 text-xs rounded-[6px] px-3 font-medium"
                          >
                            Link
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Need to connect a new repo from your GitHub organization?
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  setIsConnectNewOpen(true);
                }}
                className="text-xs text-primary hover:underline h-7 px-2 gap-1"
              >
                <span>Add new repo</span>
                <ExternalLink className="size-3" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-[6px] h-8 text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddRepositoryDialog
        open={isConnectNewOpen}
        onOpenChange={setIsConnectNewOpen}
      />
    </>
  );
}
