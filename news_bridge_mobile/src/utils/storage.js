// Cross-platform persistent storage utility
// Uses AsyncStorage on React Native (persists across app restarts)
// Uses expo-secure-store as secondary persistent storage
// Uses localStorage on web
// In-memory fallback as last resort

let AsyncStorage = null;
try {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch (e) {
  // AsyncStorage not available
}

let SecureStore = null;
try {
  SecureStore = require("expo-secure-store");
  if (SecureStore && !SecureStore.getItemAsync) SecureStore = null;
} catch (e) {
  // expo-secure-store not available
}

const memoryStore = new Map();

function log(level, msg) {
  try {
    console[level]("[storage]", msg);
  } catch {}
}

const storage = {
  getItem(key) {
    // Check memoryStore first (fastest)
    if (memoryStore.has(key)) return memoryStore.get(key);

    // Fallback to localStorage (web)
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {}

    return null;
  },

  setItem(key, value) {
    memoryStore.set(key, value);

    // AsyncStorage (native)
    if (AsyncStorage) {
      AsyncStorage.setItem(key, value).catch((err) => log("warn", `AsyncStorage.setItem "${key}" failed: ${err.message}`));
    }

    // SecureStore (native, encrypted)
    if (SecureStore) {
      SecureStore.setItemAsync(key, value).catch((err) => log("warn", `SecureStore.setItem "${key}" failed: ${err.message}`));
    }

    // localStorage (web)
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
    } catch {}
  },

  removeItem(key) {
    memoryStore.delete(key);
    if (AsyncStorage) AsyncStorage.removeItem(key).catch(() => {});
    if (SecureStore) SecureStore.deleteItemAsync(key).catch(() => {});
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    } catch {}
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

  // Load a specific key from persistent storage into memory (async)
  async loadKey(key) {
    // Already in memory
    if (memoryStore.has(key)) {
      log("log", `loadKey("${key}"): found in memory`);
      return memoryStore.get(key);
    }

    let value = null;

    // Try SecureStore (Expo-native, works reliably in managed workflow)
    if (SecureStore) {
      try {
        value = await SecureStore.getItemAsync(key);
        if (value !== null) {
          memoryStore.set(key, value);
          log("log", `loadKey("${key}"): loaded from SecureStore`);
          return value;
        }
      } catch (err) {
        log("warn", `loadKey("${key}"): SecureStore error: ${err.message}`);
      }
    }

    // Try AsyncStorage
    if (AsyncStorage) {
      try {
        value = await AsyncStorage.getItem(key);
        if (value !== null) {
          memoryStore.set(key, value);
          log("log", `loadKey("${key}"): loaded from AsyncStorage`);
          return value;
        }
      } catch (err) {
        log("warn", `loadKey("${key}"): AsyncStorage error: ${err.message}`);
      }
    }

    // Try localStorage
    try {
      if (typeof localStorage !== "undefined") {
        value = localStorage.getItem(key);
        if (value !== null) {
          memoryStore.set(key, value);
          log("log", `loadKey("${key}"): loaded from localStorage`);
          return value;
        }
      }
    } catch {}

    log("log", `loadKey("${key}"): not found`);
    return null;
  },
};

export default storage;