import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Field,
  FieldLabel,
  Input,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@reka/ui';
import { GitBranch, Check, Search, Lock, Globe, RefreshCw, Building2, User } from 'lucide-react';
import { useAddGithubRepository, useAvailableGithubRepositories, useGithubRepositories } from '../hooks/use-github-repos';

interface AddRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddRepositoryDialog({ open, onOpenChange }: AddRepositoryDialogProps) {
  const [selectedOwner, setSelectedOwner] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [selectedRepo, setSelectedRepo] = React.useState<string>('');

  const {
    data: availableRepos = [],
    isLoading,
    refetch,
    isFetching,
  } = useAvailableGithubRepositories();
  const { data: connectedRepos = [] } = useGithubRepositories();
  const addRepoMutation = useAddGithubRepository();

  const connectedSet = React.useMemo(() => {
    return new Set(connectedRepos.map((r) => r.fullName.toLowerCase()));
  }, [connectedRepos]);

  // Extract unique owners / organizations
  const availableOwners = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const r of availableRepos) {
      if (r.owner) {
        map.set(r.owner, (map.get(r.owner) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([owner, count]) => ({ owner, count }));
  }, [availableRepos]);

  // Auto-select first owner if available
  React.useEffect(() => {
    if (selectedOwner === 'all' && availableOwners.length > 0) {
      // Default to first owner/org
      setSelectedOwner(availableOwners[0].owner);
    }
  }, [availableOwners, selectedOwner]);

  // Filter by selected owner first, then by search query
  const filtered = React.useMemo(() => {
    let list = availableRepos;
    if (selectedOwner !== 'all') {
      list = list.filter((r) => r.owner?.toLowerCase() === selectedOwner.toLowerCase());
    }

    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [availableRepos, selectedOwner, search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const repo = availableRepos.find((r) => r.fullName === selectedRepo);
    const fullNameToUse = repo ? repo.fullName : search.trim();

    if (!fullNameToUse || !fullNameToUse.includes('/')) return;

    addRepoMutation.mutate(
      {
        fullName: fullNameToUse,
        defaultBranch: repo?.defaultBranch || 'main',
        isPrivate: repo?.isPrivate || false,
      },
      {
        onSuccess: () => {
          setSearch('');
          setSelectedRepo('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-w-2xl p-6 bg-popover rounded-[14px] border border-border shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader className="gap-1 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-[6px] bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/70">
                  <GitBranch className="size-3.5" />
                </div>
                <DialogTitle className="text-base font-semibold tracking-[-0.02em] text-foreground">
                  Connect GitHub Repository
                </DialogTitle>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => refetch()}
                disabled={isFetching}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Reload repositories from GitHub"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Select your GitHub organization or account, then choose the repository to link.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {/* Step 1: Select Organization / Account */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <FieldLabel className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <span>Organization</span>
                </FieldLabel>
                <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                  <SelectTrigger className="h-8 text-xs w-full bg-background rounded-[6px] border-border/80 font-mono">
                    <SelectValue placeholder="Select Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All Accounts ({availableRepos.length})</SelectItem>
                      {availableOwners.map(({ owner, count }) => (
                        <SelectItem key={owner} value={owner}>
                          <span className="font-mono text-xs">{owner}</span>
                          <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">({count})</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Search Input Filter */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <FieldLabel className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Search className="size-3.5 text-muted-foreground" />
                  <span>Filter Repository</span>
                </FieldLabel>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search repository by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    className="h-8 pl-8 text-xs font-mono bg-background rounded-[6px] border-border/80"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Selectable Repositories List */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-1">
                <span>
                  {selectedOwner !== 'all' ? `Repositories under ${selectedOwner}` : 'All Repositories'} ({filtered.length})
                </span>
                {selectedRepo && (
                  <span className="text-foreground font-semibold">
                    Selected: {selectedRepo}
                  </span>
                )}
              </div>

              <div className="rounded-[10px] border border-border divide-y divide-border/60 max-h-64 overflow-y-auto bg-card/40">
                {isLoading ? (
                  <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Loading repositories from GitHub...</span>
                  </div>
                ) : (
                  filtered.map((repo) => {
                    const isConnected = connectedSet.has(repo.fullName.toLowerCase());
                    const isSelected = selectedRepo === repo.fullName;

                    return (
                      <div
                        key={repo.id}
                        onClick={() => {
                          if (!isConnected) {
                            setSelectedRepo(repo.fullName);
                          }
                        }}
                        className={`flex items-center justify-between p-3 text-xs transition-colors ${
                          isConnected
                            ? 'opacity-40 cursor-not-allowed bg-muted/20'
                            : isSelected
                            ? 'bg-secondary text-foreground font-medium cursor-pointer ring-1 ring-inset ring-border'
                            : 'hover:bg-secondary/40 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-6 rounded-[5px] bg-secondary flex items-center justify-center shrink-0 border border-border/60">
                            {repo.isPrivate ? (
                              <Lock className="size-3 text-muted-foreground" />
                            ) : (
                              <Globe className="size-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-xs text-foreground truncate font-medium">
                              {repo.fullName}
                            </span>
                            {repo.description && (
                              <span className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                                {repo.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isConnected ? (
                            <Badge variant="outline" className="text-[10px] font-mono h-5 px-2 text-muted-foreground border-border/70">
                              Connected
                            </Badge>
                          ) : isSelected ? (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-[5px]">
                              <Check className="size-3 text-primary" />
                              <span>Selected</span>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              Select
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {!isLoading && filtered.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground flex flex-col gap-2">
                    <span>No repositories found for this organization filter.</span>
                    {search.includes('/') ? (
                      <span className="text-xs text-foreground font-mono">
                        You can connect &ldquo;{search}&rdquo; directly with the button below.
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">
                        Try clearing the search filter or typing &ldquo;owner/repo&rdquo;.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 rounded-[6px] px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={(!selectedRepo && !search.includes('/')) || addRepoMutation.isPending}
              className="h-8 rounded-[6px] px-3.5 text-xs font-medium"
            >
              {addRepoMutation.isPending ? 'Connecting...' : 'Connect Repository'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
