import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CoinState {
  coins: number;
  addCoins: (amount: number) => void;
  removeCoins: (amount: number) => boolean;
  initializeCoins: () => Promise<void>;
  setCoins: (amount: number) => void;
}

export const useCoinStore = create<CoinState>((set, get) => ({
  coins: 0,
  
  addCoins: (amount: number) => {
    set((state) => {
      const newCoins = state.coins + amount;
      AsyncStorage.setItem('@coins', String(newCoins)).catch(error => {
        console.error('Failed to save coins to storage:', error);
      });
      return { coins: newCoins };
    });
  },
  
  removeCoins: (amount: number) => {
    const { coins } = get();
    if (coins < amount) {
      return false;
    }
    
    set((state) => {
      const newCoins = state.coins - amount;
      AsyncStorage.setItem('@coins', String(newCoins)).catch(error => {
        console.error('Failed to save coins to storage:', error);
      });
      return { coins: newCoins };
    });
    
    return true;
  },
  
  initializeCoins: async () => {
    try {
      const storedCoins = await AsyncStorage.getItem('@coins');
      const coins = storedCoins ? parseInt(storedCoins, 10) : 0;
      set({ coins });
    } catch (error) {
      console.error('Failed to load coins from storage:', error);
      set({ coins: 0 });
    }
  },
  
  setCoins: (amount: number) => {
    set({ coins: amount });
    AsyncStorage.setItem('@coins', String(amount)).catch(error => {
      console.error('Failed to save coins to storage:', error);
    });
  },
})); 