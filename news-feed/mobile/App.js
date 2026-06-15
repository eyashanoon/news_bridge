import "./src/i18n/i18n";
import { useCallback, useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SessionProvider, useSession } from "./src/context/SessionContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { I18nManager } from "react-native";
import { useTranslation } from "react-i18next";
import HomePage from "./src/pages/HomePage";
import AuthPage from "./src/pages/AuthPage";
import AdvancedSearchPage from "./src/pages/AdvancedSearchPage";
import TrendingTopicsPage from "./src/pages/TrendingTopicsPage";
import TopicDetailsPage from "./src/pages/TopicDetailsPage";
import SavedNewsPage from "./src/pages/SavedNewsPage";
import AIAssistantPage from "./src/pages/AIAssistantPage";
import ApplyEditorPage from "./src/pages/ApplyEditorPage";
import ProfilePage from "./src/pages/ProfilePage";
import PresenterPage from "./src/pages/PresenterPage";
import LeftSidebar from "./src/components/LeftSidebar";
import NewsBriefPage from "./src/pages/NewsBriefPage";
import TelegramFeedPage from "./src/pages/TelegramFeedPage";
import { useTheme } from "./src/context/ThemeContext";
import { ActivityIndicator, View, Text, StyleSheet, StatusBar } from "react-native";
import { useNavigationContainerRef } from "@react-navigation/native";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";

function DarkModeWrapper() {
  const { darkMode } = useTheme();
  const { th } = require("./src/utils/darkColors");
  return <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} backgroundColor={darkMode ? "#0f172a" : "#f1f5f9"} />;
}

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [Linking.createURL("/"), "newsbridge://"],
  config: {
    screens: {
      NewsFeed: {
        path: "news/category/:category",
        parse: {
          category: (value) => value || "general",
        },
      },
      TelegramFeed: "news/telegram",
    },
  },
};

function BootScreen() {
  return (
    <View style={bootStyles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={bootStyles.text}>Initializing Secure Connection...</Text>
    </View>
  );
}

function AppNavigator() {
  const { booting } = useSession();
  const { menuOpen, setMenuOpen } = useTheme();
  const navigationRef = useNavigationContainerRef();

  if (booting) {
    return <BootScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="NewsFeed" component={HomePage} />
          <Stack.Screen name="Auth" component={AuthPage} initialParams={{ mode: "login" }} />
          <Stack.Screen name="AdvancedSearch" component={AdvancedSearchPage} />
          <Stack.Screen name="TrendingTopics" component={TrendingTopicsPage} />
          <Stack.Screen name="TopicDetails" component={TopicDetailsPage} />
          <Stack.Screen name="SavedNews" component={SavedNewsPage} />
          <Stack.Screen name="AIAssistant" component={AIAssistantPage} />
          <Stack.Screen name="ApplyEditor" component={ApplyEditorPage} />
          <Stack.Screen name="Presenter" component={PresenterPage} />
          <Stack.Screen name="NewsBrief" component={NewsBriefPage} />
          <Stack.Screen name="TelegramFeed" component={TelegramFeedPage} />
          <Stack.Screen name="Profile" component={ProfilePage} />
        </Stack.Navigator>
      </NavigationContainer>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, direction: "ltr" }} pointerEvents="box-none">
        <LeftSidebar
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          navigationRef={navigationRef}
        />
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SessionProvider>
        <ThemeProvider>
          <DarkModeWrapper />
          <AppNavigator />
        </ThemeProvider>
      </SessionProvider>
    </View>
  );
}

const bootStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  text: { marginTop: 12, fontSize: 16, color: "#64748b" },
});