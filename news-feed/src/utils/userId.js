// src/utils/userId.js
import { getUserId as getStoredUserId } from "./auth";

export function getUserId() {
  return getStoredUserId();
}