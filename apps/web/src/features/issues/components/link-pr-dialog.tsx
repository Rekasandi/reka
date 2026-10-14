import * as React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  Button, Field, FieldLabel, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem,
} from '@reka/ui';
import { GitPullRequest, Lock, RefreshCw } from 'lucide-react';
import { useIssueGithubRepositories, useLinkPullRequest } from '../hooks/use-github-integration';

interface LinkPullRequestDialogProps {
  issueId: string;
  issueIdentifier: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkPullRequestDialog({ issueId, issueIdentifier, open, onOpenChange }: LinkPullRequestDialogProps) {
  const [repositoryId, setRepositoryId] = React.useState('');
  const [prNumber, setPrNumber] = React.useState('');
  const { data: repositories = [], isLoading, isError, refetch } = useIssueGithubRepositories(issueId);
  const linkMutation = useLinkPullRequest(issueId);

  React.useEffect(() => {
    if (!open) return;
    setRepositoryId(repositories[0]?.id || '');
    setPrNumber('');
  }, [open, repositories]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const number = Number(prNumber);
    if (!repositoryId || !Number.isSafeInteger(number) || number <= 0) return;
    linkMutation.mutate({ repositoryId, prNumber: number }, {
      onSuccess: () => {
        setPrNumber('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <GitPullRequest className="size-4" />
              <DialogTitle className="text-base">Link GitHub Pull Request</DialogTitle>
            </div>
            <DialogDescription>
              Verify an existing pull request for <span className="font-mono font-semibold text-foreground">{issueIdentifier}</span>. Title, branch and merge state come from GitHub.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="py-5 text-center text-sm text-muted-foreground" role="status">Loading repositories…</div>
          ) : isError ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 p-3" role="alert">
              <p className="text-sm text-muted-foreground">Could not load repositories linked to this issue.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : repositories.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Link a GitHub repository to this issue&apos;s project before attaching a pull request.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Field>
                <FieldLabel>Connected repository</FieldLabel>
                <Select value={repositoryId} onValueChange={setRepositoryId}>
                  <SelectTrigger size="compact" className="w-full"><SelectValue placeholder="Choose repository" /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    {repositories.map((repository) => <SelectItem key={repository.id} value={repository.id}>
                      <span className="flex items-center gap-2"><span>{repository.fullName}</span>{repository.isPrivate && <Lock className="size-3" />}</span>
                    </SelectItem>)}
                  </SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Pull request number</FieldLabel>
                <Input
                  type="number" min="1" step="1" required autoFocus
                  placeholder="e.g. 42" value={prNumber}
                  onChange={(event) => setPrNumber(event.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </Field>
              {linkMutation.isError && <p className="text-xs text-destructive" role="alert">{linkMutation.error.message}</p>}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!repositoryId || !prNumber.trim() || linkMutation.isPending || isLoading || isError || repositories.length === 0}>
              {linkMutation.isPending ? <><RefreshCw className="mr-1.5 size-3 animate-spin" /> Verifying…</> : 'Verify and link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
