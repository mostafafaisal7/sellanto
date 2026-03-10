import { create } from 'zustand';
import type { DiamondWallet, DiamondUsageBreakdown, DiamondCosts } from '../types';
import { diamondService } from '../services/diamondService';

interface DiamondState {
  // Wallet
  wallet: DiamondWallet | null;
  walletLoading: boolean;
  fetchWallet: () => Promise<void>;

  // Usage breakdown
  usage: DiamondUsageBreakdown | null;
  usageLoading: boolean;
  fetchUsage: (days?: number) => Promise<void>;

  // Cost table
  costs: DiamondCosts | null;
  fetchCosts: () => Promise<void>;

  // Insufficient diamonds modal
  showInsufficientModal: boolean;
  insufficientData: { cost: number; balance: number; feature?: string } | null;
  openInsufficientModal: (cost: number, balance: number, feature?: string) => void;
  closeInsufficientModal: () => void;
}

export const useDiamondStore = create<DiamondState>()((set) => ({
  // Wallet
  wallet: null,
  walletLoading: false,
  fetchWallet: async () => {
    set({ walletLoading: true });
    try {
      const wallet = await diamondService.getBalance();
      set({ wallet, walletLoading: false });
    } catch {
      set({ walletLoading: false });
    }
  },

  // Usage
  usage: null,
  usageLoading: false,
  fetchUsage: async (days = 30) => {
    set({ usageLoading: true });
    try {
      const usage = await diamondService.getUsage(days);
      set({ usage, usageLoading: false });
    } catch {
      set({ usageLoading: false });
    }
  },

  // Cost table
  costs: null,
  fetchCosts: async () => {
    try {
      const costs = await diamondService.getCosts();
      set({ costs });
    } catch {
      // silent
    }
  },

  // Insufficient diamonds modal
  showInsufficientModal: false,
  insufficientData: null,
  openInsufficientModal: (cost, balance, feature) => {
    set({
      showInsufficientModal: true,
      insufficientData: { cost, balance, feature },
    });
  },
  closeInsufficientModal: () => {
    set({ showInsufficientModal: false, insufficientData: null });
  },
}));

export default useDiamondStore;
