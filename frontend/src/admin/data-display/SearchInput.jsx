export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className = "admin-search",
  ...props
}) {
  return (
    <input
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
}
