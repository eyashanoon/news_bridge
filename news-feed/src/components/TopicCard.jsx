// TopicCard.jsx
export default function TopicCard({ topic, onViewTopic }) {
  return (
    <div className="topic-card">
      {/* Title + Trending Indicator */}
      <div className="topic-card-header">
        <h2
          className="topic-card-title"
          onClick={() => onViewTopic(topic.id)}
        >
          {topic.title}
        </h2>

        <div className="topic-growth">
          🔥 {topic.growth}%
        </div>
      </div>

      {/* Summary */}
      <p className="topic-summary">{topic.summary}</p>

      {/* Stats */}
      <div className="topic-stats">
        <span>📝 {topic.posts} posts</span>
        <span>👥 {topic.contributors} contributors</span>
      </div>

      {/* Tags */}
      <div className="topic-tags">
        {topic.tags.map((tag, idx) => (
          <span key={idx} className="topic-tag">#{tag}</span>
        ))}
      </div>

      {/* Buttons */}
      <div className="topic-card-footer">
        <button
          className="text-blue-600 hover:underline font-medium text-sm"
          onClick={() => onViewTopic(topic.id)}
        >
          View Topic
        </button>

        <button className="bg-orange-500 text-white px-4 py-1.5 rounded-lg hover:bg-orange-600 transition text-sm font-semibold">
          Follow
        </button>
      </div>
    </div>
  );
}