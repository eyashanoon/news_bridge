// ChatWidget.jsx
export default function ChatWidget({ category }) {
  return (
    <div className="p-4">
      <div className="bg-white rounded-xl shadow h-96 flex flex-col">
        <div className="p-3 border-b font-semibold">
          AI Assistant ({category})
        </div>
        <div className="flex-1 p-3 text-gray-500">
          Ask about {category} news...
        </div>
      </div>
    </div>
  );
}