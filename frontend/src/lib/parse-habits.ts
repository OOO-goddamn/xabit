export const MAX_DRAFT_ITEMS = 30;
export const MAX_DRAFT_NAME_LENGTH = 120;
export const MAX_DRAFT_INPUT_LENGTH = 4000;

// Leading bullets, numbering ("1." / "1)") and empty checkboxes are common in
// brain dumps, so they are stripped instead of becoming part of the name.
const listMarker = /^(?:[-–—*•·+]+|\d+[.)]|\[\s?\])\s*/;

/**
 * Splits a free-form list into habit name drafts.
 *
 * Rules: one item per line or after a semicolon, list markers are removed,
 * duplicates are dropped and headings ending with ":" are skipped.
 */
export function parseHabitDrafts(raw: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const part of raw.replace(/\r\n?/g, "\n").split(/[\n;]+/)) {
    const cleaned = part.replace(listMarker, "").replace(/\s+/g, " ").trim();
    if (!cleaned || cleaned.endsWith(":")) {
      continue;
    }

    const name = Array.from(cleaned).slice(0, MAX_DRAFT_NAME_LENGTH).join("").trim();
    if (!name) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push(name);
    if (items.length >= MAX_DRAFT_ITEMS) {
      break;
    }
  }

  return items;
}
