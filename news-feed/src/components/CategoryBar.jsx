// CategoryBar.jsx
import { categories } from "../utils/categoryConfig";

const colorMap = {
  gray: "bg-gray-600",
  purple: "bg-purple-600",
  green: "bg-green-600",
  red: "bg-red-600",
  blue: "bg-blue-600",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  cyan: "bg-cyan-500",
};

export default function CategoryBar({ category, setCategory }) {
  return (
    <div className="w-full sticky top-14 z-10 backdrop-blur bg-white/70 border-b px-4 py-2 flex gap-3 overflow-x-auto">
      {categories.map((cat) => (
        <button
            key={cat.name}
            onClick={() => setCategory(cat.name)}
            className={`px-4 py-1 rounded-full whitespace-nowrap transition font-medium
                ${
                category === cat.name
                    ? `${colorMap[cat.color]} text-white shadow-md ring-2 ring-black/10 scale-105`
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
            >
            {cat.name}
        </button>
      ))}
    </div>
  );
}