import { Stack } from "expo-router";
import "../src/i18n/i18n"; // Initialize i18n BEFORE any component mounts
import { ThemeProvider } from "../src/context/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
