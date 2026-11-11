import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge, cn } from '@reka/ui';

/**
 * Page width rule: list, board and dashboard pages use the full content width;
 * detail, settings and reading pages are capped at `max-w-5xl` so text keeps a readable measure.
 */
export function PageContainer({ width = 'full', className, children }: {
  width?: 'full' | 'narrow';
  className?: string;
  children: ReactNode;
}) {
  return <div data-slot="page" className={cn('mx-auto flex w-full min-w-0 flex-col gap-6 pb-10', width === 'narrow' && 'max-w-5xl', className)}>{children}</div>;
}

/** The one page header: title (the page's only h1), optional count/badge, description and actions. */
export function PageHeader({ title, count, badge, description, actions, className }: {
  title: ReactNode;
  count?: number;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return <header data-slot="page-header" className={cn('flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4', className)}>
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
        <h1 className={PAGE_TITLE_CLASS}>{title}</h1>
        {count !== undefined && <Badge variant="outline" className="text-xs font-medium tabular-nums">{count}</Badge>}
        {badge}
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
  </header>;
}

/** Shared title style for detail pages that build their own header around an editable title. */
export const PAGE_TITLE_CLASS = 'min-w-0 break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl';

/** Empty collections: say what is missing and, when the viewer can fix it, offer the next step. */
export function EmptyState({ icon: Icon, title, description, action, className }: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <div data-slot="empty-state" className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center', className)}>
    {Icon && <span className="flex size-10 items-center justify-center rounded-full bg-muted"><Icon aria-hidden="true" className="size-5 text-muted-foreground" /></span>}
    <div className="flex max-w-sm flex-col gap-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>;
}
