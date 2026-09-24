import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Button } from '@reka/ui';
import { Plus } from 'lucide-react';

export function ProjectsPage() {
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Projects</h1>
          <p className="text-xs text-muted-foreground">High-level software delivery streams.</p>
        </div>
        <Button size="sm">
          <Plus data-icon="inline-start" />
          <span>New Project</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:border-foreground/30 transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>REKA Platform</CardTitle>
              <Badge variant="secondary">In Progress</Badge>
            </div>
            <CardDescription>
              Internal project and task management platform for Rekasandi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">reka-platform</span>
              <span>•</span>
              <span>12 issues</span>
            </div>
          </CardContent>
          <CardFooter className="justify-between text-xs text-muted-foreground border-t border-border pt-3">
            <span>Target: Q4 2026</span>
            <Badge variant="outline">On Track</Badge>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
