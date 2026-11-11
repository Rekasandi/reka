import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Field, FieldLabel, FieldError, Input, Alert, Spinner } from '@reka/ui';
import { SelectField } from '../../../components/common/select-field';
import { useForm } from '@tanstack/react-form';
import { GitPullRequest, Lock, RefreshCw } from 'lucide-react';
import { useIssueGithubRepositories, useLinkPullRequest } from '../hooks/use-github-integration';

interface LinkPullRequestDialogProps {
  issueId: string;
  issueIdentifier: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NO_REPOSITORIES: ReadonlyArray<never> = [];

export function LinkPullRequestDialog({ issueId, issueIdentifier, open, onOpenChange }: LinkPullRequestDialogProps) {
  const { data: repositories = NO_REPOSITORIES, isLoading, isError, refetch } = useIssueGithubRepositories(issueId);
  const linkMutation = useLinkPullRequest(issueId);

  const form = useForm({
    defaultValues: { repositoryId: repositories[0]?.id || '', prNumber: '' },
    onSubmit: ({ value }) => {
      const number = Number(value.prNumber);
      if (!value.repositoryId || !Number.isSafeInteger(number) || number <= 0) return;
      linkMutation.mutate({ repositoryId: value.repositoryId, prNumber: number }, {
        onSuccess: () => {
          form.setFieldValue('prNumber', '');
          onOpenChange(false);
        },
      });
    },
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset();
  }, [open, repositories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg">
        <form onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }} className="flex flex-col gap-4">
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
            <div className="py-5 text-center text-sm text-muted-foreground"><Spinner aria-label="Loading repositories" /> Loading repositories…</div>
          ) : isError ? (
            <Alert variant="destructive" className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Could not load repositories linked to this issue.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </Alert>
          ) : repositories.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Link a GitHub repository to this issue&apos;s project before attaching a pull request.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <form.Field name="repositoryId" children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Connected repository</FieldLabel>
                  <SelectField id={field.name} name={field.name} value={field.state.value} onValueChange={field.handleChange} placeholder="Choose repository" className="w-full" options={repositories.map(repository => ({ value: repository.id, label: <span className="flex items-center gap-2"><span>{repository.fullName}</span>{repository.isPrivate && <Lock className="size-3" />}</span> }))} />
                </Field>
              )} />
              <form.Field
                name="prNumber"
                validators={{ onChange: ({ value }) => (value.trim() !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) ? 'Enter a positive whole number' : undefined) }}
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Pull request number</FieldLabel>
                      <Input
                        id={field.name} name={field.name} type="number" min="1" step="1" required autoFocus
                        placeholder="e.g. 42" value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />
              {linkMutation.isError && <FieldError role="alert" className="text-xs text-destructive">{linkMutation.error.message}</FieldError>}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <form.Subscribe
              selector={(state) => state.values}
              children={(values) => (
                <Button type="submit" size="sm" disabled={!values.repositoryId || !values.prNumber.trim() || linkMutation.isPending || isLoading || isError || repositories.length === 0}>
                  {linkMutation.isPending ? <><RefreshCw className="mr-1.5 size-3 animate-spin" /> Verifying…</> : 'Verify and link'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
