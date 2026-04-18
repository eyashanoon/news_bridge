// TopBar.jsx
const gradientMap = {
  General: "from-gray-600 to-gray-400",
  Politics: "from-blue-600 to-blue-400",
  Sports: "from-orange-500 to-orange-300",
  Finance: "from-green-600 to-green-400",
  Medical: "from-red-600 to-red-400",
  Tech: "from-cyan-600 to-cyan-400",
  Culture: "from-purple-600 to-purple-400",
  Religion: "from-amber-500 to-yellow-300",
};

export default function TopBar({ category }) {
  return (
    <div className={`w-full h-14 text-white flex items-center justify-between px-6 shadow bg-gradient-to-r ${gradientMap[category]}`}>
      <div className="font-bold text-lg">AI News</div>

      <div className="flex gap-4">
        <button className="bg-white text-black px-3 py-1 rounded">Login</button>
        <button className="bg-white text-black px-3 py-1 rounded">Sign Up</button>
        <button className="bg-black/20 px-3 py-1 rounded">Logout</button>
      </div>
    </div>
  );
}