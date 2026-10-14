import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@reka/ui';
import { ArrowLeft, Home } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-md flex-col items-start gap-5">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">Check the address, or return to your dashboard to find what you need.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft data-icon="inline-start" />Go Back</Button>
          <Button asChild><Link to="/dashboard"><Home data-icon="inline-start" />Back to Dashboard</Link></Button>
        </div>
      </div>
    </main>
  );
}
