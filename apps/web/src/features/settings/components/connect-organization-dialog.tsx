import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@reka/ui';
import { ExternalLink, ShieldCheck } from 'lucide-react';

interface ConnectOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectOrganizationDialog({ open, onOpenChange }: ConnectOrganizationDialogProps) {
  const startInstallation = () => {
    window.location.assign('/api/integrations/github/installations/connect');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-500" />
            <DialogTitle className="text-base font-semibold">Install the REKA GitHub App</DialogTitle>
          </div>
          <DialogDescription className="text-xs leading-relaxed">
            Connect an account or organization through GitHub&apos;s verified installation flow. Repository access and webhook events are not enabled by entering an account name.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          You&apos;ll choose the GitHub account and repositories on GitHub. Only a verified installation can be saved to this workspace.
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={startInstallation} className="gap-1.5">
            Install on GitHub <ExternalLink className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
