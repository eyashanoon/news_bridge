const defaults = {
  width: 18,
  height: 18,
  strokeWidth: 1.75,
  "aria-hidden": true,
};

function Icon({ children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...defaults}
      {...props}
    >
      {children}
    </svg>
  );
}

export const NAV_ICONS = {
  layoutDashboard: () => (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  ),
  users: () => (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  ),
  userCog: () => (
    <Icon>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a4 4 0 0 1 4-4h2" />
      <circle cx="19" cy="17" r="2" />
      <path d="m19 15.5-.9.9" />
      <path d="M19 19v2" />
      <path d="m21.1 17.1.9-.9" />
      <path d="M17 17h-2" />
      <path d="m16.1 17.1-.9-.9" />
    </Icon>
  ),
  shield: () => (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </Icon>
  ),
  keyRound: () => (
    <Icon>
      <path d="M2 18v3c0 .6.4 1 1 1h3" />
      <path d="M14 6a6 6 0 0 1 6 6v1" />
      <path d="M22 13h-4v4" />
      <circle cx="10" cy="12" r="4" />
    </Icon>
  ),
  fileEdit: () => (
    <Icon>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </Icon>
  ),
  newspaper: () => (
    <Icon>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </Icon>
  ),
  tags: () => (
    <Icon>
      <path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l6.6-6.6a1 1 0 0 0 0-1.4L12 2Z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </Icon>
  ),
  send: () => (
    <Icon>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </Icon>
  ),
  globe: () => (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </Icon>
  ),
  bot: () => (
    <Icon>
      <path d="M12 8V4H8" />
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M9 13v2" />
      <path d="M15 13v2" />
    </Icon>
  ),
  settings: () => (
    <Icon>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
  lock: () => (
    <Icon>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Icon>
  ),
  chevronDown: () => (
    <Icon width={16} height={16}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  ),
  panelLeft: () => (
    <Icon width={16} height={16}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </Icon>
  ),
};

export function NavIcon({ name, className }) {
  const Render = NAV_ICONS[name];
  if (!Render) return null;
  return <span className={className}>{Render()}</span>;
}
