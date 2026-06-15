import { useState, useEffect, cloneElement, isValidElement, Children } from "react";
import { createPortal } from "react-dom";

function isExpandableChild(child) {
  if (!isValidElement(child)) return false;
  if (typeof child.type === "string") return false;
  const className = child.props?.className;
  if (typeof className === "string") {
    if (className.includes("admin-empty-hint") || className.includes("admin-chart-empty")) {
      return false;
    }
  }
  return true;
}

function enrichChild(child, { title, description, expanded = false }) {
  if (!isValidElement(child)) return child;
  return cloneElement(child, {
    ...child.props,
    title: child.props.title ?? title,
    description: child.props.description ?? description,
    expanded,
  });
}

export function ExpandableChartArea({ title, subtitle, description, children, className = "" }) {
  const chartDescription = description ?? subtitle;
  const [open, setOpen] = useState(false);
  const child = Children.only(children);
  const expandable = isExpandableChild(child);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!expandable) {
    return children;
  }

  return (
    <>
      <div
        className={`admin-chart-expandable ${className}`.trim()}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={title ? `Expand ${title} chart` : "Expand chart"}
        title="Click to expand"
      >
        {children}
      </div>
      {open &&
        createPortal(
          <div
            className="admin-chart-expand-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={title || "Chart preview"}
            onClick={() => setOpen(false)}
          >
            <div className="admin-chart-expand-modal" onClick={(event) => event.stopPropagation()}>
              <header className="admin-chart-expand-header">
                <div className="admin-chart-expand-titles">
                  {title ? <h2>{title}</h2> : null}
                  {subtitle ? <p>{subtitle}</p> : null}
                </div>
                <button
                  type="button"
                  className="admin-chart-expand-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close chart preview"
                >
                  ×
                </button>
              </header>
              <div className="admin-chart-expand-body">
                {enrichChild(child, { title, description: chartDescription, expanded: true })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
