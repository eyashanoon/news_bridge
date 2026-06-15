import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NavIcon } from "../constants/navIcons";
import {
  findActiveGroupId,
  getVisibleNavGroups,
  isNavItemActive,
  resolveNavItemTarget,
} from "../constants/navConfig";

const STORAGE_KEY = "admin-nav-expanded";

function loadExpandedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveExpandedState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function AdminSidebar({ roles = [], collapsed = false }) {
  const location = useLocation();
  const navRef = useRef(null);
  const activeGroupId = findActiveGroupId(location.pathname);
  const visibleGroups = useMemo(() => getVisibleNavGroups(roles), [roles]);

  const [expanded, setExpanded] = useState(() => {
    const saved = loadExpandedState();
    const initial = {};
    for (const group of visibleGroups) {
      initial[group.id] = saved[group.id] ?? true;
    }
    return initial;
  });

  useEffect(() => {
    if (!activeGroupId) return;
    setExpanded((prev) => {
      if (prev[activeGroupId]) return prev;
      const next = { ...prev, [activeGroupId]: true };
      saveExpandedState(next);
      return next;
    });
  }, [activeGroupId]);

  const toggleGroup = useCallback((groupId) => {
    if (collapsed) return;
    setExpanded((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      saveExpandedState(next);
      return next;
    });
  }, [collapsed]);

  const focusAdjacentLink = useCallback((direction) => {
    const links = Array.from(
      navRef.current?.querySelectorAll("a.admin-nav-item:not([aria-disabled])") || []
    );
    if (!links.length) return;

    const index = links.indexOf(document.activeElement);
    const nextIndex =
      direction === "down"
        ? (index + 1) % links.length
        : (index <= 0 ? links.length : index) - 1;

    links[nextIndex]?.focus();
  }, []);

  const handleNavKeyDown = useCallback(
    (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusAdjacentLink("down");
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusAdjacentLink("up");
      }
    },
    [focusAdjacentLink]
  );

  return (
    <nav
      ref={navRef}
      className="admin-nav admin-nav-grouped"
      aria-label="Admin navigation"
      onKeyDown={handleNavKeyDown}
    >
      {visibleGroups.map((group) => {
        const isGroupActive = group.id === activeGroupId;
        const isOpen = collapsed || expanded[group.id] !== false;

        return (
          <section
            key={group.id}
            className={`admin-nav-group${isGroupActive ? " admin-nav-group--active" : ""}${isOpen ? " admin-nav-group--open" : " admin-nav-group--collapsed"}${collapsed ? " admin-nav-group--rail" : ""}`}
            data-section={group.id}
            aria-label={collapsed ? group.label : undefined}
          >
            {!collapsed && (
              <button
                type="button"
                className="admin-nav-group-trigger"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`nav-group-${group.id}`}
              >
                <span className="admin-nav-group-trigger-main">
                  <NavIcon name={group.icon} className="admin-nav-icon admin-nav-icon--group" />
                  <span className="admin-nav-group-label">{group.label}</span>
                </span>
                <NavIcon
                  name="chevronDown"
                  className={`admin-nav-chevron${isOpen ? " admin-nav-chevron--open" : ""}`}
                />
              </button>
            )}

            <div
              id={`nav-group-${group.id}`}
              className="admin-nav-group-items"
              hidden={!collapsed && !isOpen}
            >
              {group.items.map((item) => {
                const active = isNavItemActive(item, location.pathname);
                const tooltip = collapsed ? item.label : item.description;

                if (item.comingSoon) {
                  return (
                    <span
                      key={item.id}
                      className="admin-nav-item admin-nav-item--soon"
                      title={tooltip}
                      aria-disabled="true"
                    >
                      <NavIcon name={item.icon} className="admin-nav-icon" />
                      {!collapsed && (
                        <>
                          <span className="admin-nav-item-label">{item.label}</span>
                          <span className="admin-nav-soon-badge">Soon</span>
                        </>
                      )}
                    </span>
                  );
                }

                const target = resolveNavItemTarget(item, roles);

                return (
                  <Link
                    key={item.id}
                    to={target}
                    className={`admin-nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    title={tooltip}
                  >
                    <NavIcon name={item.icon} className="admin-nav-icon" />
                    {!collapsed && <span className="admin-nav-item-label">{item.label}</span>}
                    {active && <span className="admin-nav-active-indicator" aria-hidden="true" />}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
