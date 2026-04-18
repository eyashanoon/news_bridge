// TopicPost.jsx
import Post from "./Post";

export default function TopicPost({ post }) {
  return (
    <div className="mt-6">
      <Post post={post} />
    </div>
  );
}