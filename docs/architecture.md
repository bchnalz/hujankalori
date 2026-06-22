# Architecture

## Stack
- **Phaser 3** — 2D web game engine. WebGL with automatic Canvas fallback;
  strong mobile-browser performance; built-in touch input, sprite sheets,
  texture atlases, arcade physics. Ideal for the asset-driven PNG model.
- **TypeScript** — type safety across config-driven systems.
- **Vite** — fast dev server + optimized production build; first-class on Vercel.

See [`adr/ADR-0001-web-stack.md`](adr/ADR-0001-web-stack.md) for the decision.

## Rendering / scaling
- Fixed **design resolution 720×1280** (portrait).
- `Phaser.Scale.FIT` + `CENTER_BOTH` → scales to any phone screen while keeping
  aspect, with input coordinates auto-mapped. Robust inside an iframe.
- **Dynamic viewport:** `#app` uses `100dvh`, and `main.ts` listens to
  `window.visualViewport` resize/scroll to size the container to the *visible*
  area (so the mobile address bar showing/hiding never crops the canvas), calling
  `game.scale.refresh()` on change and rotation.
- **Fullscreen:** a tap toggle (`addFullscreenToggle` → `scale.toggleFullscreen()`)
  on the Menu and How-to-play screens. Hidden where the Fullscreen API is
  unavailable (e.g. iOS Safari). Cannot be auto-triggered (needs a user gesture);
  inside an iframe the host must set `allow="fullscreen"`.

## Directory structure

```
src/
  main.ts                 # Phaser.Game bootstrap + scene list
  config/
    gameConfig.ts         # HP, player, item, difficulty tuning (data, not logic)
    itemConfig.ts         # Falling-item registry (asset path + type + value)
    playerConfig.ts       # Player base sprite sheets per gender
    assetManifest.ts      # Background + UI asset keys
  data/
    types.ts              # GameUser, SessionResult, Gender
    DataProvider.ts       # Interface (swap point for real data)
    DummyDataProvider.ts   # Local stand-in used now
    laperBridge.ts        # Reads LAPER signed token (iframe/URL) — stub
  objects/Player.ts       # Avatar (touch-follow movement, catch body)
  systems/
    Difficulty.ts         # ramp(t): spawn interval, fall speed, type weights
    Spawner.ts            # Weighted, time-driven item spawning
    FallingItem.ts        # Physics sprite carrying its ItemDef
  ui/
    Hud.ts                # HP bar + survival timer
    Button.ts             # Reusable button
  scenes/
    BootScene.ts          # Resolve identity → registry
    PreloadScene.ts       # Load assets from config, build anims
    MenuScene.ts          # Title + start
    GameScene.ts          # Core loop + difficulty + catch handling
    GameOverScene.ts      # Survival time + retry/menu
public/assets/            # PNGs (generated placeholders; gitignored)
scripts/gen-placeholders.mjs  # Pure-Node PNG generator (no deps)
```

## Scene flow
`Boot → Preload → Menu → Game → GameOver → (Game | Menu)`

## Data layer & LAPER integration plan
The game never talks to LAPER directly from gameplay code. Everything goes
through the `DataProvider` interface:

- **Now:** `DummyDataProvider` supplies a random username + gender so the game
  is fully playable/reviewable offline.
- **Later:** a `LaperDataProvider` implements the same interface:
  - **Identity:** LAPER passes a **signed token** via the iframe URL (`?token=`)
    or `postMessage`; `laperBridge.ts` is the single boundary that reads it.
    Verification happens **server-side** once LAPER provides the token contract.
  - **Game records** (tokens, points, leaderboard, cosmetic ownership, personal
    records) live in a **separate Supabase project** (distinct from LAPER
    production), accessed via serverless endpoints. Username/gender come from
    LAPER; game state comes from the game DB.

Because gameplay depends only on `DataProvider`, swapping providers requires **no
changes** to scenes or systems.

## Deployment plan (GAME-11)
- Deploy as an **independent Vercel project** (`vite build` → `dist/`).
- LAPER embeds it via **iframe** (or link); a load failure leaves LAPER
  unaffected.
- The game DB is a **separate Supabase** instance, so game traffic is isolated
  from LAPER production.
- Assets are generated at build time via the `prebuild` hook, so a clean Vercel
  build always has placeholder art until real assets are committed.
