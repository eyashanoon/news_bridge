// LeftSidebar.jsx
export default function LeftSidebar({ setActivePage, activePage }) {
  const buttonClass = (page) =>
    `bg-white rounded-xl shadow p-4 cursor-pointer transition hover:shadow-md ${
      activePage === page ? "border-l-4 border-blue-500 font-semibold" : ""
    }`;

  return (
    <div className="p-4 space-y-4">
      <div
        className={buttonClass("HOME")}
        onClick={() => setActivePage("HOME")}
      >
        📰 Categories / Feed
      </div>

      <div
        className={buttonClass("TRENDING")}
        onClick={() => setActivePage("TRENDING")}
      >
        🔥 Trending Topics
      </div>

      <div
        className={buttonClass("SAVED")}
        onClick={() => setActivePage("SAVED")}
      >
        💾 Saved News
      </div>
    </div>
  );
}