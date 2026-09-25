import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@reka/ui';
import { ArrowLeft, Home, Compass } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background selection:bg-foreground selection:text-background">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        {/* Geist 404 Badge */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-secondary text-foreground border border-border/70">
            404
          </span>
          <span className="text-xs font-mono text-muted-foreground">PAGE NOT FOUND</span>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.04em] text-foreground">
            This page does not exist.
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            The link you followed may be broken, or the page may have been moved or removed.
          </p>
        </div>

        {/* Minimal Hairline Wire Card */}
        <div className="w-full rounded-[12px] border border-border/70 bg-card/30 p-4 flex flex-col gap-2 text-left font-mono text-xs text-muted-foreground">
          <div className="flex items-center justify-between pb-2 border-b border-border/50 text-[11px]">
            <span className="text-foreground font-medium flex items-center gap-1.5">
              <Compass className="size-3.5 text-muted-foreground" />
              <span>Location Lookup</span>
            </span>
            <span className="text-muted-foreground/60">{window.location.pathname}</span>
          </div>
          <p className="text-[11px] leading-relaxed pt-1 text-muted-foreground/80">
            Verify the URL in your browser or jump back to an active workspace surface.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-8 rounded-[6px] text-xs gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Go Back</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-8 rounded-[6px] text-xs gap-1.5 font-medium"
          >
            <Link to="/dashboard">
              <Home className="size-3.5" />
              <span>Back to Dashboard</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
