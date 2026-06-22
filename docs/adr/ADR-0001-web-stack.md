# ADR-0001 — Web rendering stack for Calorie Catcher

- **Status:** Accepted
- **Date:** 2026-06-21
- **Context story:** GAME-01, GAME-02, GAME-11

## Context
Calorie Catcher is a 2D falling-item catcher that must run **smoothly on
smartphone browsers**, be **embedded via iframe** in LAPER on a **separate
Vercel** deployment, and follow an **asset-driven** design (swappable PNGs).

## Decision
Use **Phaser 3 + TypeScript + Vite**.

- **Phaser 3** is purpose-built for 2D web games: WebGL with Canvas fallback,
  efficient sprite/atlas batching, built-in touch input and arcade physics, and
  a loader that maps directly onto the asset-driven PNG model. Strong, proven
  mobile-browser performance.
- **TypeScript** gives safety to the config-driven systems (items, difficulty).
- **Vite** provides fast iteration and an optimized static build that deploys to
  Vercel with zero special configuration.

## Alternatives considered
- **PixiJS + custom logic** — lighter renderer, but we'd hand-build the game loop,
  input, physics, and scene management that Phaser provides out of the box.
- **Vanilla HTML5 Canvas** — smallest footprint, but the most boilerplate and
  slowest to reach a polished, maintainable game.
- **Godot 4 web export** — the CCGS-native engine, but a tens-of-MB WASM payload
  is heavy for a tiny iframe minigame and its resource model is a poor fit for
  the designer-driven PNG-swap workflow this feature mandates.

## Consequences
- (+) Fast path to a playable, mobile-smooth game; asset pipeline matches the spec.
- (+) Easy Vercel deploy; clean isolation from LAPER production.
- (−) Phaser adds ~1.2 MB JS (≈344 KB gzip) to the bundle. Acceptable for a
  game; can be revisited with code-splitting/CDN if needed.
