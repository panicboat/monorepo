
import { create } from "zustand";

type ModalType = string | null;

interface UiState {
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;

  activeModal: ModalType;
  modalData: Record<string, unknown> | null;
  openModal: (modal: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  activeModal: null,
  modalData: null,
  openModal: (modal, data = {}) => set({ activeModal: modal, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),

  isGlobalLoading: false,
  setGlobalLoading: (loading) => set({ isGlobalLoading: loading }),
}));

export const selectIsSidebarOpen = (state: UiState) => state.isSidebarOpen;
export const selectActiveModal = (state: UiState) => state.activeModal;
export const selectModalData = (state: UiState) => state.modalData;
export const selectIsGlobalLoading = (state: UiState) => state.isGlobalLoading;
