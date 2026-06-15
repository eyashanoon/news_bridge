// rtl.js — RTL layout utilities for React Native
import { I18nManager, Platform } from "react-native";
import i18n from "../i18n/i18n";

/**
 * Check if the current UI language is RTL (Arabic).
 */
export function isRTL() {
  return i18n.language === "ar";
}

/**
 * Get text alignment based on current language direction.
 * @param {string} [rtlAlign="right"] - Alignment for RTL mode
 * @param {string} [ltrAlign="left"] - Alignment for LTR mode
 */
export function textAlign(rtlAlign = "right", ltrAlign = "left") {
  return isRTL() ? rtlAlign : ltrAlign;
}

/**
 * Get flex direction based on current language direction.
 */
export function flexDirection() {
  return isRTL() ? "row-reverse" : "row";
}

/**
 * Get writing direction style based on current language.
 */
export function writingDirection() {
  return isRTL() ? "rtl" : "ltr";
}

/**
 * Get margin/padding start/end values swapped for RTL.
 * Use this for consistent spacing in RTL mode.
 */
export function startEnd(startVal, endVal) {
  return isRTL()
    ? { marginRight: startVal, marginLeft: endVal }
    : { marginLeft: startVal, marginRight: endVal };
}

/**
 * Apply RTL-aware alignment to a view.
 * Returns a style object with flexDirection, textAlign, and writingDirection.
 */
export function rtlViewStyle() {
  return {
    flexDirection: isRTL() ? "row-reverse" : "row",
  };
}

/**
 * Apply RTL-aware text alignment.
 */
export function rtlTextStyle() {
  return {
    textAlign: isRTL() ? "right" : "left",
    writingDirection: isRTL() ? "rtl" : "ltr",
  };
}

/**
 * Initialize RTL settings on app startup.
 * Should be called BEFORE any rendering occurs.
 */
export function initializeRTL() {
  const lang = i18n.language || "en";
  const rtl = lang === "ar";
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(rtl);
  // Note: In React Native, forceRTL only takes effect before the first render.
  // For dynamic switching, we handle it via conditional styles.
}

/**
 * Get a self-alignment value for RTL.
 */
export function alignSelf(rtlValue = "flex-start", ltrValue = "flex-start") {
  return isRTL() ? rtlValue : ltrValue;
}