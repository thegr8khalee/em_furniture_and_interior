import { create } from 'zustand';
import { toast } from 'react-hot-toast';

const LOCAL_STORAGE_COMPARE_KEY = 'compareProducts';
const SESSION_STORAGE_COMPARE_KEY = 'compareProductsSession';

const getConsentStatus = () => {
  const consentValue = localStorage.getItem('cookie_consent_accepted');
  return {
    hasResponded: consentValue !== null,
    isAccepted: consentValue === 'true',
  };
};

const getStoredCompareIds = () => {
  try {
    const { isAccepted } = getConsentStatus();
    if (isAccepted) {
      const stored = localStorage.getItem(LOCAL_STORAGE_COMPARE_KEY);
      return stored ? JSON.parse(stored) : [];
    }

    const sessionStored = sessionStorage.getItem(SESSION_STORAGE_COMPARE_KEY);
    return sessionStored ? JSON.parse(sessionStored) : [];
  } catch (error) {
    console.error('Error reading compare ids from storage:', error);
    return [];
  }
};

const saveCompareIds = (ids) => {
  try {
    const { isAccepted } = getConsentStatus();
    if (isAccepted) {
      localStorage.setItem(LOCAL_STORAGE_COMPARE_KEY, JSON.stringify(ids));
      sessionStorage.removeItem(SESSION_STORAGE_COMPARE_KEY);
    } else {
      sessionStorage.setItem(SESSION_STORAGE_COMPARE_KEY, JSON.stringify(ids));
      localStorage.removeItem(LOCAL_STORAGE_COMPARE_KEY);
    }
  } catch (error) {
    console.error('Error saving compare ids to storage:', error);
  }
};

export const useCompareStore = create((set, get) => ({
  compareIds: getStoredCompareIds(),
  maxItems: 4,

  addToCompare: (productId) => {
    const { compareIds, maxItems } = get();
    if (compareIds.includes(productId)) {
      toast('Already in compare list.');
      return;
    }
    if (compareIds.length >= maxItems) {
      toast(`You can compare up to ${maxItems} products.`);
      return;
    }

    const nextIds = [...compareIds, productId];
    saveCompareIds(nextIds);
    set({ compareIds: nextIds });
  },

  removeFromCompare: (productId) => {
    const nextIds = get().compareIds.filter((id) => id !== productId);
    saveCompareIds(nextIds);
    set({ compareIds: nextIds });
  },

  toggleCompare: (productId) => {
    const { compareIds } = get();
    if (compareIds.includes(productId)) {
      const nextIds = compareIds.filter((id) => id !== productId);
      saveCompareIds(nextIds);
      set({ compareIds: nextIds });
      return;
    }

    get().addToCompare(productId);
  },

  setCompareIds: (ids) => {
    const nextIds = Array.isArray(ids) ? ids : [];
    saveCompareIds(nextIds);
    set({ compareIds: nextIds });
  },

  clearCompare: () => {
    saveCompareIds([]);
    set({ compareIds: [] });
  },
}));
