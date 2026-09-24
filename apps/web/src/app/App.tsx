import * as React from 'react';
import { RouterProvider } from 'react-router-dom';
import { Providers } from './providers';
import { router } from './router';
import { Toaster } from '@reka/ui';

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors />
    </Providers>
  );
}
export default App;
