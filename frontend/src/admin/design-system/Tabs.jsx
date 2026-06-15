export function Tabs({ items, activeId, onChange, className = "" }) {
  return (
    <div className={`admin-tabs ${className}`.trim()}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`admin-tab ${activeId === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
