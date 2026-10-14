import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../stores/ui.store';

export function useKeyboardShortcuts() {
  const setCommandPaletteOpen = useUiStore(state => state.setCommandPaletteOpen);
  const isCommandPaletteOpen = useUiStore(state => state.isCommandPaletteOpen);
  const navigate = useNavigate();
  const goPending = useRef(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setCommandPaletteOpen(!isCommandPaletteOpen); return;
      }
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="dialog"], [role="menu"], [role="menuitem"], button, a')) return;
      if (goPending.current) {
        goPending.current = false;
        const routes: Record<string, string> = { i: '/my-issues', p: '/projects', d: '/documents', n: '/initiatives', r: '/roadmap', s: '/settings', f: '/favorites', t: '/triage' };
        const route = routes[event.key.toLowerCase()];
        if (route) { event.preventDefault(); navigate(route); }
        return;
      }
      if (event.key.toLowerCase() === 'g') {
        goPending.current = true;
        window.setTimeout(() => { goPending.current = false; }, 900);
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault(); navigate('/issues?create=1');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, navigate, setCommandPaletteOpen]);
}
