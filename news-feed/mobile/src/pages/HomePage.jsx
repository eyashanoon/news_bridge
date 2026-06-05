import { useState } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import TopBar from "../components/TopBar";
import CategoryBar from "../components/CategoryBar";
import Feed from "../components/Feed";
import PostModal from "../components/PostModal";
import { useTheme } from "../context/ThemeContext";
import { categoryTheme } from "../utils/categoryColors";
import { dark as dc, th } from "../utils/darkColors";

export default function HomePage({ navigation, route }) {
  const { currentCategory, setCurrentCategory, darkMode } = useTheme();
  const [modalPost, setModalPost] = useState(null);

  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;

  // Open post from deep link or search result
  const initialPostId = route?.params?.openPostId;
  const [deepLinkPostId, setDeepLinkPostId] = useState(initialPostId);

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg) }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.bg} />
      <TopBar navigation={navigation} />
      <CategoryBar category={currentCategory} setCategory={setCurrentCategory} />
      <Feed
        category={currentCategory}
        onAskAI={(post) => navigation.navigate("AIAssistant", { selectedPost: post, category: currentCategory })}
        onPostPress={setModalPost}
        navigation={navigation}
      />
      <PostModal post={modalPost} visible={!!modalPost} onClose={() => setModalPost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});