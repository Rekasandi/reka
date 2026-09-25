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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from '@reka/ui';
import { GitPullRequest, ExternalLink, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLinkPullRequest } from '../hooks/use-github-integration';

interface LinkPullRequestDialogProps {
  issueId: string;
  issueIdentifier: string;
  branchName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkPullRequestDialog({
  issueId,
  issueIdentifier,
  branchName,
  open,
  onOpenChange,
}: LinkPullRequestDialogProps) {
  const [prNumber, setPrNumber] = React.useState('');
  const [prTitle, setPrTitle] = React.useState('');
  const [prUrl, setPrUrl] = React.useState('');
  const [isMerged, setIsMerged] = React.useState(false);
  const [ciStatus, setCiStatus] = React.useState<'pending' | 'success' | 'failure'>('success');
  const [reviewStatus, setReviewStatus] = React.useState<'none' | 'changes_requested' | 'approved'>('approved');
  const [deployEnv, setDeployEnv] = React.useState<'production' | 'preview'>('preview');
  const [releaseTag, setReleaseTag] = React.useState('');

  const linkMutation = useLinkPullRequest(issueId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(prNumber.trim(), 10);
    if (!num || !prTitle.trim()) return;

    const url = prUrl.trim() || `https://github.com/rekasandi/reka/pull/${num}`;

    linkMutation.mutate(
      {
        prNumber: num,
        title: prTitle.trim(),
        branchName,
        htmlUrl: url,
        merged: isMerged,
        ciStatus,
        reviewStatus,
        deployEnv,
        deployUrl: deployEnv === 'production' ? 'https://reka.dev' : `https://pr-${num}.reka-preview.app`,
        releaseTag: releaseTag.trim() || undefined,
      },
      {
        onSuccess: () => {
          setPrNumber('');
          setPrTitle('');
          setPrUrl('');
          setIsMerged(false);
          setReleaseTag('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-[5px] bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/70">
                <GitPullRequest className="size-3.5" />
              </div>
              <DialogTitle className="text-base">Link GitHub Pull Request</DialogTitle>
            </div>
            <DialogDescription>
              Connect PR & tracking details for <span className="font-mono font-semibold text-foreground">{issueIdentifier}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            <div className="grid grid-cols-3 gap-2.5">
              <Field>
                <FieldLabel>PR #</FieldLabel>
                <Input
                  type="number"
                  placeholder="e.g. 42"
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                  autoFocus
                  required
                  className="h-8 text-xs font-mono"
                />
              </Field>

              <div className="col-span-2">
                <Field>
                  <FieldLabel>Pull Request Title</FieldLabel>
                  <Input
                    placeholder="feat: implement sync engine"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    required
                    className="h-8 text-xs"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field>
                <FieldLabel>CI/CD Build Checks</FieldLabel>
                <Select value={ciStatus} onValueChange={(val) => setCiStatus(val as any)}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="success">All Checks Passing</SelectItem>
                      <SelectItem value="pending">Building / In Progress</SelectItem>
                      <SelectItem value="failure">Tests / Checks Failed</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Code Review Status</FieldLabel>
                <Select value={reviewStatus} onValueChange={(val) => setReviewStatus(val as any)}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="changes_requested">Changes Requested</SelectItem>
                      <SelectItem value="none">Review Requested</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field>
                <FieldLabel>Deployment Preview</FieldLabel>
                <Select value={deployEnv} onValueChange={(val) => setDeployEnv(val as any)}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="preview">Preview / Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Release Tag (Optional)</FieldLabel>
                <Input
                  placeholder="v1.2.0"
                  value={releaseTag}
                  onChange={(e) => setReleaseTag(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel className="text-muted-foreground">GitHub PR URL (Optional)</FieldLabel>
              <Input
                type="url"
                placeholder="https://github.com/rekasandi/reka/pull/42"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isMerged"
                checked={isMerged}
                onChange={(e) => setIsMerged(e.target.checked)}
                className="size-3.5 rounded border border-border bg-transparent checked:bg-primary accent-primary cursor-pointer"
              />
              <label htmlFor="isMerged" className="text-xs text-foreground cursor-pointer select-none">
                PR is already merged (auto-moves issue to Done)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!prNumber.trim() || !prTitle.trim() || linkMutation.isPending}
            >
              {linkMutation.isPending ? 'Linking...' : 'Link Pull Request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
