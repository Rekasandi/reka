import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@reka/ui';
import { Plus } from 'lucide-react';

export function CyclesPage() {
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Cycles</h1>
          <p className="text-xs text-muted-foreground">Time-boxed engineering sprints.</p>
        </div>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          <span>New Cycle</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cycle 24 (Active)</CardTitle>
            <Badge>Current</Badge>
          </div>
          <CardDescription>Sep 21 — Oct 4</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[72%]" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>24 completed</span>
            <span>72%</span>
          </div>
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground border-t border-border pt-3">
          <span>5 in progress • 4 todo • 2 blocked</span>
        </CardFooter>
      </Card>
    </div>
  );
}
