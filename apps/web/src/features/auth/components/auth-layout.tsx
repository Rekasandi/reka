import * as React from 'react';
import { Link } from 'react-router-dom';

/** Shared shell for sign-in, sign-up and onboarding screens. */
export function AuthLayout({ title, description, children, footer, wide = false }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <section className={`flex w-full flex-col gap-6 ${wide ? 'max-w-lg' : 'max-w-sm'}`}>
        <Link to="/" className="flex w-fit items-center gap-2" aria-label="REKA home">
          <span className="flex size-6 items-center justify-center rounded-sm bg-foreground text-xs font-semibold text-background">R</span>
          <span className="text-sm font-semibold tracking-tight">REKA</span>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
        {footer && <div className="flex flex-col gap-2 text-xs text-muted-foreground">{footer}</div>}
      </section>
    </main>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg role="img" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className || 'size-4'} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** Where to go after signing in: a same-origin path from ?redirect, else the app root. */
export function safeRedirect(value: string | null, fallback = '/') {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}
