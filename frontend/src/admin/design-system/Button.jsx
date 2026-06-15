export function Button({
  children,
  variant = "default",
  size = "default",
  className = "",
  type = "button",
  ...props
}) {
  const variantClass =
    variant === "primary"
      ? "primary"
      : variant === "danger"
        ? "danger"
        : variant === "accent"
          ? "accent"
          : variant === "muted"
            ? "muted"
            : "";

  const sizeClass = size === "small" ? " small" : "";

  return (
    <button
      type={type}
      className={`admin-btn${sizeClass}${variantClass ? ` ${variantClass}` : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
