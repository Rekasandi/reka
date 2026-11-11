import { Button, cn } from '@reka/ui';
import { ArrowLeft, ExternalLink, Mail, RefreshCw } from 'lucide-react';

export interface EmailSentViewProps {
  email: string;
  title?: string;
  description?: string;
  note?: string;
  onResend?: () => void;
  onBack?: () => void;
  resending?: boolean;
}

function getWebmailInfo(email: string): { url: string; label: string } | null {
  const atIndex = email.indexOf('@');
  const domain = atIndex >= 0 ? email.slice(atIndex + 1).toLowerCase() : '';
  if (domain === 'gmail.com') {
    return { url: 'https://mail.google.com', label: 'Gmail' };
  }
  if (domain === 'outlook.com' || domain === 'hotmail.com') {
    return { url: 'https://outlook.live.com', label: 'Outlook' };
  }
  if (domain === 'yahoo.com') {
    return { url: 'https://mail.yahoo.com', label: 'Yahoo Mail' };
  }
  return null;
}

export function EmailSentView({
  email,
  title = 'Check your email',
  description = 'We sent a temporary sign-in link to your email address.',
  note = 'The link expires in 15 minutes and can only be used once.',
  onResend,
  onBack,
  resending = false,
}: EmailSentViewProps) {
  const webmail = getWebmailInfo(email);

  return (
    <div className="flex flex-col items-center text-center gap-5 py-2">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/20">
        <Mail className="size-6" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-sm">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
        <p className="text-xs font-mono font-medium text-foreground bg-muted/50 px-2.5 py-1 rounded-md border border-border mt-1 break-all select-all">
          {email}
        </p>
      </div>
      <p className="text-xs text-muted-foreground/80 max-w-xs">
        {note}
      </p>

      <div className="flex w-full flex-col gap-2 pt-1">
        {webmail && (
          <Button variant="default" className="w-full justify-center gap-2" asChild>
            <a href={webmail.url} target="_blank" rel="noopener noreferrer">
              Open {webmail.label}
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
        {onResend && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-2"
            disabled={resending}
            onClick={onResend}
          >
            <RefreshCw className={cn('size-3.5', resending && 'animate-spin')} />
            {resending ? 'Sending again…' : 'Resend email link'}
          </Button>
        )}
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground justify-center gap-1.5"
            onClick={onBack}
          >
            <ArrowLeft className="size-3.5" />
            Use a different email
          </Button>
        )}
      </div>
    </div>
  );
}
