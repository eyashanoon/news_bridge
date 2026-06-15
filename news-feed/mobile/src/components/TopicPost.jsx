import Post from "./Post";

export default function TopicPost({ post, onPress, onAskAI, topic }) {
  const contentBlocks = [];
  if (post.text) {
    const paragraphs = post.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach((p, i) => contentBlocks.push({ type: "paragraph", text: p, sortOrder: i + 1 }));
  }
  if (post.mediaUrl) {
    contentBlocks.push({ type: "media", url: post.mediaUrl, mediaType: post.mediaType || "image", sortOrder: contentBlocks.length + 1 });
  }

  let mediaItems = [];
  if (post.mediaItems && Array.isArray(post.mediaItems) && post.mediaItems.length > 0) {
    mediaItems = post.mediaItems;
  } else if (post.mediaUrl) {
    mediaItems = [{ type: post.mediaType || "image", url: post.mediaUrl }];
  }

  const mappedPost = {
    id: post.id,
    label: post.label || "Update",
    title: post.title || "",
    text: post.text || "",
    articleUrl: null,
    articleId: null,
    numImages: mediaItems.filter((m) => m.type === "image").length,
    numVideos: mediaItems.filter((m) => m.type === "video").length,
    lang: post.lang || "en",
    tags: post.tags || [],
    likes: post.likes ?? 0,
    dislikes: post.dislikes ?? 0,
    userReaction: post.userReaction ?? null,
    articleCreatedAt: post.createdAt,
    mediaUrl: mediaItems.length > 0 ? mediaItems[0].url : null,
    mediaType: mediaItems.length > 0 ? mediaItems[0].type : null,
    mediaItems: mediaItems,
    authorName: post.author || null,
    authorAvatar: post.authorProfilePicture || null,
    authorId: post.authorId || null,
    isTopicPost: true,
    _content: contentBlocks,
    topicId: topic?.id || post.topicId || null,
    topicTitle: topic?.title || null,
    topicDescription: topic?.description || null,
    topicImageUrl: topic?.imageUrl || null,
    topicTags: topic?.tags || [],
  };

  return <Post post={mappedPost} onPress={onPress} onAskAI={onAskAI} />;
}