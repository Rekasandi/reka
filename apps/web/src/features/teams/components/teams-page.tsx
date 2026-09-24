import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@reka/ui';
import { Plus } from 'lucide-react';

export function TeamsPage() {
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Teams</h1>
          <p className="text-xs text-muted-foreground">Cross-functional squads inside Rekasandi.</p>
        </div>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          <span>New Team</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Engineering</CardTitle>
              <Badge variant="outline" className="font-mono">RS</Badge>
            </div>
            <CardDescription>Core product engineering squad.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Responsible for core platform, APIs, infrastructure, and delivery pipelines.</p>
          </CardContent>
          <CardFooter className="border-t border-border pt-3 text-xs text-muted-foreground">
            <span>6 members</span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
