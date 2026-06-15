import { api, authConfig } from "../../api";

export { api, authConfig };

export function withAuth(token) {
  return authConfig(token);
}
