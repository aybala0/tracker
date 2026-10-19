import { useEffect, useSyncExternalStore } from "react";
import { MAJOR_CATEGORIES } from "../constants/categories";

export type Major = { slug: string; name: string; custom: boolean };

/**
 * Module-level store for the full major category list: the built-in ten
 * (known immediately, so nothing waits on the network) plus user-defined
 * ones from GET /api/categories. A plain store rather than per-component
 * state so synchronous helpers like colorForCategory can read it too.
 */
let majors: Major[] = MAJOR_CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, custom: false }));
const listeners = new Set<() => void>();
let initialLoad: Promise<void> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current major list, in display order (custom ones sit just before Other). */
export function getMajors(): Major[] {
  return majors;
}

export function refreshMajors(): Promise<void> {
  return fetch("/api/categories")
    .then((res) => (res.ok ? res.json() : Promise.reject(res)))
    .then((data: Major[]) => {
      majors = data.map((m) => ({ slug: m.slug, name: m.name, custom: m.custom }));
      listeners.forEach((l) => l());
    })
    .catch(() => {
      // Keep the built-in list — custom majors just won't show until the next refresh.
    });
}

/** Creates (or finds, by case-insensitive name) a custom major, then refreshes the shared list. */
export async function createMajor(name: string): Promise<Major> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Failed to create category.");
  }
  const major = (await res.json()) as Major;
  await refreshMajors();
  return major;
}

/** Subscribes to the major list, kicking off the one-time fetch of custom majors on first use. */
export function useMajors(): Major[] {
  useEffect(() => {
    initialLoad ??= refreshMajors();
  }, []);
  return useSyncExternalStore(subscribe, getMajors);
}
