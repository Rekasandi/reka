import { useEffect } from 'react';
import { useUiStore } from '../stores/ui.store';

export function useKeyboardShortcuts() {
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const isCommandPaletteOpen = useUiStore((state) => state.isCommandPaletteOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette: Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);
}
