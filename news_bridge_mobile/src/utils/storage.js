// Cross-platform storage utility
// Uses localStorage on web, in-memory fallback on React Native
// This prevents crashes from 'localStorage is not defined' errors

const memoryStore = new Map();

const storage = {
  getItem(key) {
    try {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(key);
      }
    } catch {}
    return memoryStore.get(key) ?? null;
  },

  setItem(key, value) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStore.set(key, value);
  },

  removeItem(key) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStore.delete(key);
  },

  getJSON(key) {
    try {
      const raw = this.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setJSON(key, value) {
    this.setItem(key, JSON.stringify(value));
  },
};

export default storage;