import * as React from 'react';
import { UNSAFE_DataRouterContext, useBlocker, type Location } from 'react-router-dom';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';

const DISCARD_TITLE = 'Discard unsaved changes?';
const DISCARD_DESCRIPTION = 'Your changes have not been saved. If you leave now, they will be lost.';

/** Asks before discarding edits: the browser prompt on reload/close, and a dialog on in-app navigation. */
export function UnsavedChangesGuard({ when, isSamePage = samePageAndTab }: {
  when: boolean;
  /** Navigation that keeps the edits on screen (e.g. switching settings sections) is not blocked. */
  isSamePage?: (current: Location, next: Location) => boolean;
}) {
  React.useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);
  // useBlocker needs a data router; test harnesses mounting a plain MemoryRouter only get the unload prompt.
  return React.useContext(UNSAFE_DataRouterContext) ? <RouteBlocker when={when} isSamePage={isSamePage} /> : null;
}

function samePageAndTab(current: Location, next: Location) {
  return current.pathname === next.pathname && new URLSearchParams(current.search).get('tab') === new URLSearchParams(next.search).get('tab');
}

function RouteBlocker({ when, isSamePage }: { when: boolean; isSamePage: (current: Location, next: Location) => boolean }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => when && !isSamePage(currentLocation, nextLocation));
  return <ConfirmDeleteDialog open={blocker.state === 'blocked'} onOpenChange={open => { if (!open && blocker.state === 'blocked') blocker.reset(); }}
    title={DISCARD_TITLE} description={DISCARD_DESCRIPTION} confirmLabel="Discard changes" onConfirm={() => blocker.proceed?.()} />;
}

/** Same confirmation for closing a dialog or sheet that holds unsaved edits. */
export function DiscardChangesDialog({ open, onOpenChange, onDiscard }: { open: boolean; onOpenChange: (open: boolean) => void; onDiscard: () => void }) {
  return <ConfirmDeleteDialog open={open} onOpenChange={onOpenChange} title={DISCARD_TITLE} description={DISCARD_DESCRIPTION} confirmLabel="Discard changes" onConfirm={onDiscard} />;
}
