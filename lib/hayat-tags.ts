// Emoji mapping for the Hayat sheet's Tag column, mirrored from hayat's own
// TAGS constant (hayat/src/config.ts) so tags created here look consistent
// with tags hayat itself creates. Categories with no hayat equivalent (e.g.
// finance_tracker's "Home") fall back to the generic emoji + their own name,
// rather than inventing a new hayat tag.
const FALLBACK_EMOJI = "\u{1F4E6}"; // 📦

const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Drinks": "\u{1F354}", // 🍔
  Groceries: "\u{1F6D2}", // 🛒
  "Rent & Bills": "\u{1F3E0}", // 🏠
  Car: "\u{1F6DE}", // 🛞
  Transportation: "\u{1F697}", // 🚗
  Fun: "\u{1F389}", // 🎉
  Shopping: "\u{1F6CD}️", // 🛍️
  Travel: "✈️", // ✈️
  Other: FALLBACK_EMOJI, // 📦
};

/** Builds a sheet Tag value ("emoji categoryName") for a finance_tracker category. */
export function categoryNameToTag(categoryName: string): string {
  const emoji = CATEGORY_EMOJI[categoryName] ?? FALLBACK_EMOJI;
  return `${emoji} ${categoryName}`;
}

/**
 * Strips a leading emoji (plus any following whitespace) off a sheet Tag
 * value, e.g. "🏠 Rent & Bills" -> "Rent & Bills". Emoji and other symbol
 * characters aren't Unicode letters, so stripping any leading run of
 * non-letter characters handles multi-codepoint emoji (with variation
 * selectors, ZWJ sequences, etc.) without needing an exhaustive emoji regex.
 */
export function stripTagEmoji(tag: string): string {
  return tag.replace(/^[^\p{L}]+/u, "").trim();
}
