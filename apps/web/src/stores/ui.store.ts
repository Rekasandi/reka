import { create } from 'zustand';

interface UiState {
  isSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  activeView: 'list' | 'board';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveView: (view: 'list' | 'board') => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: true,
  isCommandPaletteOpen: false,
  activeView: 'list',
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setActiveView: (view) => set({ activeView: view }),
}));
