// shadcn/ui table with the Reka table standard baked in, so pages don't restyle it:
// - framed container (rounded-lg border), scrolls horizontally on narrow screens
// - header: 36px, muted background, 12px medium muted labels, sentence case
// - body rows: min 44px, 14px text, hairline dividers, subtle hover
// - 12px horizontal cell padding everywhere; numbers go right-aligned with tabular-nums
import * as React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '../lib/utils';

function Table({ className, containerClassName, ...props }: React.ComponentProps<'table'> & { containerClassName?: string }) {
  return <div data-slot="table-container" className={cn('relative w-full overflow-x-auto rounded-lg border border-border bg-background', containerClassName)}><table data-slot="table" className={cn('w-full caption-bottom text-sm', className)} {...props} /></div>;
}
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('bg-muted/40 [&_tr]:border-b [&_tr]:hover:bg-transparent', className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return <tfoot data-slot="table-footer" className={cn('border-t bg-muted/40 font-medium [&>tr]:last:border-b-0', className)} {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr data-slot="table-row" className={cn('border-b border-border transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted', className)} {...props} />;
}
/** Column header. Used with scope="row" inside a body row, it renders like a primary body cell. */
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return <th data-slot="table-head" className={cn(
    'h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0',
    '[&[scope=row]]:h-11 [&[scope=row]]:py-2 [&[scope=row]]:text-sm [&[scope=row]]:text-foreground',
    className,
  )} {...props} />;
}
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('h-11 px-3 py-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0', className)} {...props} />;
}
function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return <caption data-slot="table-caption" className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />;
}
/** Sortable column header: the arrow shows the current direction, the button label says what a click does. */
function TableSortHead({ direction, onSort, sortLabel, children, className, ...props }: Omit<React.ComponentProps<'th'>, 'aria-sort'> & {
  direction: 'asc' | 'desc';
  onSort: () => void;
  sortLabel: string;
}) {
  const Icon = direction === 'asc' ? ArrowUp : ArrowDown;
  return <TableHead aria-sort={direction === 'asc' ? 'ascending' : 'descending'} className={className} {...props}>
    <button type="button" onClick={onSort} aria-label={sortLabel}
      className="-mx-1.5 inline-flex h-6 cursor-pointer items-center gap-1 rounded-sm px-1.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {children}<Icon aria-hidden="true" className="size-3" />
    </button>
  </TableHead>;
}
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableSortHead, TableRow, TableCell, TableCaption };
