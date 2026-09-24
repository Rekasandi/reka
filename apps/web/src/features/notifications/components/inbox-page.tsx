import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@reka/ui';
import { Bell } from 'lucide-react';

export function InboxPage() {
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Inbox</h1>
        <p className="text-xs text-muted-foreground">Notifications, mentions, and pull request reviews.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center gap-2">
          <Bell className="size-6 text-muted-foreground opacity-50" />
          <h2 className="text-xs font-semibold text-foreground">All caught up</h2>
          <p className="text-xs text-muted-foreground">No unread notifications or pending items.</p>
        </CardContent>
      </Card>
    </div>
  );
}
