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
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from '@reka/ui';
import { Building2, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { useConnectGithubOrganization, useAvailableGithubRepositories } from '../hooks/use-github-repos';
import { useAuthStore } from '../../../stores/auth.store';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'size-4'} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface ConnectOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLogin?: string;
}

export function ConnectOrganizationDialog({
  open,
  onOpenChange,
  defaultLogin,
}: ConnectOrganizationDialogProps) {
  const { user } = useAuthStore();
  const connectMutation = useConnectGithubOrganization();
  const { data: availableRepos = [] } = useAvailableGithubRepositories();

  // Resolve GitHub username from authenticated user
  const userProfileLogin = React.useMemo(() => {
    if (user?.githubUsername) return user.githubUsername;
    if (defaultLogin) return defaultLogin;
    if (user?.email?.includes('@users.noreply.github.com')) {
      return user.email.replace('@users.noreply.github.com', '');
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return '';
  }, [user, defaultLogin]);

  const [accountLogin, setAccountLogin] = React.useState('');

  // Extract unique organization / owner logins from available repos & profile
  const suggestedLogins = React.useMemo(() => {
    const set = new Set<string>();
    if (userProfileLogin) set.add(userProfileLogin);
    for (const r of availableRepos) {
      if (r.owner) set.add(r.owner);
    }
    return Array.from(set);
  }, [availableRepos, userProfileLogin]);

  // Initialize only when dialog transitions from closed to open
  React.useEffect(() => {
    if (open) {
      setAccountLogin(userProfileLogin);
    }
  }, [open, userProfileLogin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = accountLogin.trim();
    if (!clean) return;

    connectMutation.mutate(
      { accountLogin: clean, accountType: 'Organization' },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  const handleInstallApp = () => {
    // Redirect to GitHub App installation flow
    window.location.href = '/api/integrations/github/installations/connect';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <GithubIcon className="size-4 text-foreground" />
              <DialogTitle className="text-base font-semibold">
                Connect GitHub Organization
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs leading-relaxed">
              Connect a GitHub Organization to enable repository linking across all projects in this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            {/* Preferred option: GitHub App Installation */}
            <div className="rounded-lg border border-border/80 bg-secondary/30 p-3.5 flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-foreground">
                    Install GitHub App (Recommended)
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Install the official REKA GitHub App on your organization or account to automatically sync webhooks and permissions.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleInstallApp}
                className="w-full text-xs h-7.5 gap-1.5 mt-1 rounded-[6px]"
              >
                <span>Install on GitHub</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-px bg-border flex-1" />
              <span className="text-xs font-medium text-muted-foreground">
                or specify organization name
              </span>
              <div className="h-px bg-border flex-1" />
            </div>

            {/* Manual Organization / Account Name with Combobox */}
            <Field>
              <FieldLabel className="text-xs font-medium text-foreground">
                Organization or User Login
              </FieldLabel>
              <Combobox
                items={suggestedLogins}
                value={accountLogin}
                onValueChange={(val) => {
                  if (typeof val === 'string') setAccountLogin(val);
                }}
                onInputValueChange={(newInput) => {
                  setAccountLogin(newInput);
                }}
              >
                <div className="relative flex items-center">
                  <ComboboxInput
                    placeholder="e.g. rekasandi, vercel, facebook"
                    value={accountLogin}
                    onChange={(e) => setAccountLogin(e.target.value)}
                    className="h-8 text-xs font-mono bg-background/80 pr-7"
                    required
                  />
                  {accountLogin && (
                    <button
                      type="button"
                      onClick={() => setAccountLogin('')}
                      className="absolute right-2 text-muted-foreground/60 hover:text-foreground p-0.5 rounded transition-colors"
                      title="Clear input"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                <ComboboxContent>
                  <ComboboxEmpty>
                    {accountLogin ? `Press Enter or click Connect to use "${accountLogin}"` : 'Type organization or account name'}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(item: string) => (
                      <ComboboxItem key={item} value={item}>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs">{item}</span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </Field>

            {suggestedLogins.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono">Discovered:</span>
                {suggestedLogins.map((login) => (
                  <button
                    key={login}
                    type="button"
                    onClick={() => setAccountLogin(login)}
                    className={`text-xs font-mono px-2 py-0.5 rounded-[4px] border transition-colors flex items-center gap-1 ${
                      accountLogin === login
                        ? 'bg-foreground text-background border-foreground font-semibold'
                        : 'border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Building2 className="size-2.5" />
                    <span>{login}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-[6px] h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!accountLogin.trim() || connectMutation.isPending}
              className="rounded-[6px] h-8 text-xs font-medium"
            >
              {connectMutation.isPending ? 'Connecting...' : 'Connect Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
