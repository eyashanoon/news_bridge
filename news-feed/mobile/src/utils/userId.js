import { getUserId as getStoredUserId } from "./auth";

export async function getUserId() {
  return getStoredUserId();
}