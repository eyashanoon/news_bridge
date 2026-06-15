export function hasRole(session, ...roles) {
  const userRoles = session?.roles || [];
  return roles.some((r) => userRoles.includes(r));
}

export function hasAnyRole(session, roles = []) {
  if (!roles.length) return true;
  return hasRole(session, ...roles);
}
