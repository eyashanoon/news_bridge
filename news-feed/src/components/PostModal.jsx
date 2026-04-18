// PostModal.jsx
export default function PostModal({ post, onClose }) {
  if (!post) return null;

  const numImages = post.numImages || 0;

  const placeholderImages = Array.from({ length: numImages }, (_, i) => ({
    id: i,
    url: "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=",
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* background overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* modal window */}
      <div className="relative z-50 bg-white w-[95%] md:w-[95%] max-w-screen-2xl h-[90%] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* header */}
        <div className="p-5 border-b flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">
            {post.title || "Untitled Post"}
          </h1>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* left side text */}
          <div className="w-full md:w-2/3 p-5 overflow-y-auto border-r">
            <div className="text-sm text-gray-500 mb-3">
              {post.label} · {post.lang}
            </div>

            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {post.text}
            </p>
          </div>

          {/* right side images */}
          <div className="hidden md:flex md:w-1/3 flex-col p-5 overflow-y-auto bg-gray-50">
            <h2 className="font-semibold text-gray-700 mb-3">
              Images ({numImages})
            </h2>

            {numImages === 0 ? (
              <div className="text-gray-500 text-sm">
                No images available for this post.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {placeholderImages.map((img) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt="post-img"
                    className="w-full rounded-lg object-cover shadow-sm"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <div className="p-4 border-t flex justify-between items-center bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition text-gray-700 font-medium"
          >
            Collapse
          </button>

          <button
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium"
          >
            Visit Original Article
          </button>
        </div>
      </div>
    </div>
  );
}