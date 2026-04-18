// TopicCard.jsx
export default function TopicCard({ topic, onViewTopic }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md transition border-l-4 border-orange-500">
      
      {/* Title + Trending Indicator */}
      <div className="flex justify-between items-start">
        <h2 className="font-semibold text-lg text-gray-800 cursor-pointer hover:underline">
          {topic.title}
        </h2>

        <div className="text-sm font-semibold text-orange-600">
          🔥 {topic.growth}%
        </div>
      </div>

      {/* Summary */}
      <p className="text-gray-600 mt-2 text-sm">
        {topic.summary}
      </p>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-gray-500 mt-3">
        <span>📝 {topic.posts} posts</span>
        <span>👥 {topic.contributors} contributors</span>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mt-3">
        {topic.tags.map((tag, idx) => (
          <span
            key={idx}
            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t text-sm">
        <button
            className="text-blue-600 hover:underline font-medium"
            onClick={() => onViewTopic(topic.id)}
            >
            View Topic
        </button>

        <button className="bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 transition">
          Follow
        </button>
      </div>
    </div>
  );
}