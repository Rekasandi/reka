// Browser-test harnesses (apps/web/test/*.mjs) import framework modules through this file so they share
// the app's module instances. Vite serves optimized deps with per-file "?v=" hashes; importing a dep by a
// guessed URL creates a second React / React Query copy and breaks providers. Not used by the app itself.
export { default as React } from 'react';
export { default as ReactDOM } from 'react-dom/client';
export { QueryClient, QueryClientProvider } from '@tanstack/react-query';
export { MemoryRouter, BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
