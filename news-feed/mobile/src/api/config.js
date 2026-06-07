import { Platform } from "react-native";

// Default: Android emulator uses 10.0.2.2 to reach host machine
// Override by setting API_HOST env var or changing this file
// For physical device: use your machine's LAN IP (e.g., "192.168.1.5")
// For iOS simulator: use "localhost"
const DEFAULT_HOST = Platform.OS === "android" ? "192.168.1.29" : "localhost";

export const API_CONFIG = {
  host: DEFAULT_HOST,
  port: "8080",
  get baseURL() {
    return `http://${this.host}:${this.port}`;
  },
};