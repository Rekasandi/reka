import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge } from '@reka/ui';

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Good evening, Gustam</h1>
        <p className="text-xs text-muted-foreground">Engineering delivery overview for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
              My Work
            </CardTitle>
            <CardDescription className="text-2xl font-bold text-foreground">
              5
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active in-progress issues assigned to you</p>
          </CardContent>
          <CardFooter>
            <Badge variant="secondary">RS Squad</Badge>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
                Current Cycle
              </CardTitle>
              <Badge variant="outline">72%</Badge>
            </div>
            <CardDescription className="text-2xl font-bold text-foreground">
              Cycle 24
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[72%]" />
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-[11px] text-muted-foreground font-mono">Ends in 4 days</span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
              Reviews
            </CardTitle>
            <CardDescription className="text-2xl font-bold text-foreground">
              2
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">GitHub PRs waiting for your review</p>
          </CardContent>
          <CardFooter>
            <Badge variant="destructive">Pending</Badge>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
