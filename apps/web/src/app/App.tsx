import * as React from 'react';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { router } from './router';
import { Toaster } from '@reka/ui';
import { useAuthStore } from '../stores/auth.store';

export function App() {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);

  React.useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <Providers>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </Providers>
  );
}
export default App;
