import * as React from 'react';
import { Button, Input, Field, FieldLabel } from '@reka/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className || 'size-4'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const error = searchParams.get('error');

  const [emailInput, setEmailInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGithubSignIn = () => {
    setIsLoading(true);
    // Direct browser redirect to backend OAuth endpoint which handles GitHub redirect
    window.location.href = '/api/auth/github';
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      if (res.ok) {
        navigate('/dashboard');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-background selection:bg-foreground selection:text-background">
      {/* LEFT: Clean Login Form */}
      <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-r border-border/70 bg-background">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-[5px] bg-foreground text-background font-semibold text-xs">
            R
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">
            REKA
          </span>
        </div>

        {/* Center Form */}
        <div className="my-auto w-full max-w-[320px] mx-auto flex flex-col gap-6 py-12">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
              Sign in
            </h1>
            <p className="text-xs text-muted-foreground">
              Continue to your workspace
            </p>
          </div>

          {error && (
            <div className="rounded-[6px] border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive text-center">
              {decodeURIComponent(error)}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {/* GitHub Button */}
            <Button
              type="button"
              onClick={handleGithubSignIn}
              disabled={isLoading}
              className="w-full h-8 rounded-[6px] font-medium text-xs justify-center gap-2"
            >
              <GithubIcon className="size-3.5" />
              <span>{isLoading ? 'Connecting...' : 'Continue with GitHub'}</span>
            </Button>

            <div className="relative flex items-center justify-center my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/70" />
              </div>
              <span className="relative bg-background px-2 text-[10px] font-mono text-muted-foreground uppercase">
                or
              </span>
            </div>

            <form onSubmit={handleEmailSignIn} className="flex flex-col gap-2.5">
              <Field>
                <FieldLabel className="sr-only">Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  className="h-8 px-2.5 rounded-[6px] text-xs"
                />
              </Field>

              <Button
                type="submit"
                variant="outline"
                disabled={isLoading || !emailInput.trim()}
                className="w-full h-8 rounded-[6px] text-xs justify-center font-medium"
              >
                Continue with Email
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} REKA Platform
        </p>
      </div>

      {/* RIGHT: Minimalist Tech Surface (Subtle Hairline Grid + Real Issue Lineup) */}
      <div className="hidden lg:flex flex-col justify-between p-12 lg:p-16 bg-muted/20 relative select-none overflow-hidden">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="flex justify-between items-center text-xs font-mono text-muted-foreground relative z-10">
          <span>reka-workspace</span>
          <span>RS-TEAM</span>
        </div>

        {/* Clean, authentic task preview block */}
        <div className="my-auto w-full max-w-sm mx-auto flex flex-col gap-2.5 relative z-10">
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
            Active Sprint
          </div>

          <div className="rounded-[8px] border border-border/80 bg-background/90 p-3 shadow-xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary font-medium">
                RS-1
              </span>
              <span className="font-medium text-foreground truncate">
                Design system component audit
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-500 shrink-0">
              Done
            </span>
          </div>

          <div className="rounded-[8px] border border-border/80 bg-background/90 p-3 shadow-xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary font-medium">
                RS-2
              </span>
              <span className="font-medium text-foreground truncate">
                Authentication & GitHub provider
              </span>
            </div>
            <span className="text-[10px] font-mono text-amber-500 shrink-0">
              In Progress
            </span>
          </div>

          <div className="rounded-[8px] border border-border/80 bg-background/90 p-3 shadow-xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-secondary font-medium">
                RS-3
              </span>
              <span className="font-medium text-foreground truncate">
                Project roadmap & burndown engine
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0">
              Todo
            </span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-muted-foreground relative z-10">
          Fast issue tracking for high-velocity teams.
        </div>
      </div>
    </div>
  );
}
