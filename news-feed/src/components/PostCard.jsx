// PostCard.jsx
export default function PostCard({ post }) {
  return (
    <div className={`
      bg-white p-5 rounded-2xl
      shadow-sm hover:shadow-lg
      hover:-translate-y-1
      transition-all duration-300
      border-l-4 ${colors.border}
    `}>
      <h2 className="font-semibold text-lg">{post.title}</h2>
      <p className="text-gray-600 mt-2">{post.content}</p>
      <div className="text-sm text-gray-400 mt-3">Source: {post.source}</div>
    </div>
  );
}