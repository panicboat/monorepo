/**
 * UI Store
 *
 * Zustand store for global UI state management.
 * Handles modals, sidebars, and other UI state.
 *
 * Usage:
 *   const { activeModal, openModal, closeModal } = useUiStore();
 */

import { create } from "zustand";

type ModalType = string | null;

interface UiState {
  // Sidebar
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;

  // Modal
  activeModal: ModalType;
  modalData: Record<string, unknown> | null;
  openModal: (modal: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Loading overlay
  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  // Sidebar state
  isSidebarOpen: false,
  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  // Modal state
  activeModal: null,
  modalData: null,
  openModal: (modal, data = {}) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  // Loading state
  isGlobalLoading: false,
  setGlobalLoading: (loading) => set({ isGlobalLoading: loading }),
}));

/**
 * Selectors for common use cases
 */
export const selectIsSidebarOpen = (state: UiState) => state.isSidebarOpen;
export const selectActiveModal = (state: UiState) => state.activeModal;
export const selectModalData = (state: UiState) => state.modalData;
export const selectIsGlobalLoading = (state: UiState) => state.isGlobalLoading;
