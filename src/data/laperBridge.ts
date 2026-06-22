import type { GameUser } from "./types";

/**
 * LAPER passes a signed user token into the embedded game, either via the
 * iframe URL (?token=...) or via window.postMessage. This module is the single
 * boundary where that handoff is read.
 *
 * NOTE: This is a stub. Real verification MUST happen server-side once LAPER's
 * token format/signing contract is provided. Until then these helpers return
 * null and the app falls back to {@link DummyDataProvider}.
 */
export function readLaperToken(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get("token");
  return fromUrl && fromUrl.length > 0 ? fromUrl : null;
}

export function parseUserFromToken(_token: string): GameUser | null {
  // TODO(laper-integration): verify signature + decode claims (id, username, gender).
  return null;
}

export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}
