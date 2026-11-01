# Hujan Kalori — Game Design Document

## 1. Overview

A survival/endless minigame for LAPER, themed around catching and avoiding
falling food and activity items. The player catches helpful **activity** items
and avoids harmful **food** items. The game is endless; the **score is total
survival time**. Designed to encourage consistent food logging via a token-based
play system (later passes).

## 2. Scope of this iteration

| Story | Title | Status |
|-------|-------|--------|
| GAME-01 | Core game loop & survival mechanic | ✅ Implemented |
| GAME-02 | Progressive difficulty | ✅ Implemented |
| GAME-10 | Asset-driven visuals | ◑ Partial — falling items, player base, bg, UI loaded from files + config; cosmetics structure reserved |
| GAME-03/04 | Token system & consumption | ⏳ Next pass (needs backend) |
| GAME-05 | Point system | ⏳ Next pass (needs backend) |
| GAME-06 | Global leaderboard | ⏳ Next pass (needs backend) |
| GAME-07/08/09 | Cosmetics, shop, rare drop | ⏳ Next pass |
| GAME-11 | Separate deployment | ⏳ Next pass (see architecture) |

## 2a. Start flow (onboarding & intro)

- **Start screen** (`StartScene`): one big MULAI button on page load. The tap
  unlocks browser audio and opens with a lightning strike + thunder.
- **Character pick** (Menu): male/female cards; the choice is remembered per
  device (`src/data/prefs.ts`). No name is asked up front; initials are entered
  at game over for the leaderboard.
- **Interactive tutorial** (`TutorialScene`): runs automatically the first time
  MAIN is pressed on a device, and can be replayed from "CARA MAIN". Steps:
  move → catch an activity (calorie limit rises) → eat healthy food (hunger
  timer refills) → dodge heavy food. Nothing in it can end the game; "Sudah
  paham? Lewati" skips at any time. Retries from Game Over go straight to the
  countdown.
- **Countdown intro:** every run begins with a **3-2-1 → MULAI!** counter while
  the HP bar animates from **0 → 100%**. Spawning, the survival timer, and the
  starvation timer only start after "MULAI!". Tunable via `gameConfig.intro`
  (`countMs`, `goMs`).

## 3. Core loop (GAME-01)

1. Player avatar sits near the bottom, moves horizontally via touch/drag.
2. Items fall from the top at increasing speed/frequency.
3. Catching an item applies an HP effect by type.
4. Game ends when HP reaches 0. Final survival time is shown.

### HP model
- **Starting / max HP: 2000** (fixed for all players — interprets the spec's
  Indonesian-notation "2.000"). Not tied to a personal calorie limit.
- Overheal is capped at max HP by default (`allowOverheal: false`).
- **Display naming:** shown in-game as **"Batas Kalori"** (the bar) and catch
  effects in **kkal** (e.g. Nasi Padang −450 kkal, Jogging +240 kkal, Air Mineral
  netral). Internally the variable is still `hp`.

### Item effects

| Type | Folder | Effect on catch |
|------|--------|-----------------|
| Food (high-calorie) | `assets/items/food/` | **−HP** equal to the item's calorie value |
| Healthy (sayur/buah/minuman) | `assets/items/healthy/` | **−HP** by the item's small `value` (may be **0** for neutral items like air mineral) |
| Activity (olahraga) | `assets/items/activity/` | **+HP** equal to the item's calorie-burn value |

Default item values (tunable in `src/config/itemConfig.ts`):

- Food: Bakso 300, Seblak 350, Mie Goreng 380, Nasi Padang 450, Donat 250, Es Teh 70
- Healthy: per-item value — Pisang 105, Alpukat 240, Brokoli Rebus 55, Apel 50, Telur Rebus 70, Wortel 40, Air Mineral 0 (neutral)
- Activity: Jogging 5 mnt 40, Jogging 30 mnt 240, Angkat Beban 15 mnt 85, Yoga 30 mnt 100, Bersepeda 15 mnt 115, Bersepeda 45 mnt 350

Items that fall past the bottom are simply removed (no penalty) — the player is
meant to *avoid* food.

**Activity items** float down slowly (~45% of normal speed) with a gentle,
tissue-like side-to-side sway, are wrapped in a translucent bubble, and are drawn
a bit larger so they read as catchable bonuses. All of this is tunable in
`src/config/gameConfig.ts → item.floaty` (speed factor, sway, bubble, size bonus).

**Food items** are also drawn larger via `item.sizeBonusByType.food` so they read
clearly against the background.

### Controls
- **Touch/drag** (primary): drag anywhere — the avatar moves **relative** to your
  finger's movement (no teleport-to-touch). The player is raised above a footer
  "foothold" band so mobile browser chrome doesn't cover it; each caught item
  shows a **pop-up (icon + name + ±HP)** in that footer space. When the hunger
  timer is low, a **red screen border pulses** and the phone vibrates once.
- **Arrow keys** (desktop testing): nudge left/right.

## 4. Progressive difficulty (GAME-02)

Difficulty is a smooth function of elapsed survival time `t`, using an
asymptotic ramp (no abrupt jumps):

```
ramp(t) = 1 − e^(−t / tauSeconds)        // 0 → 1, tau = 70s by default
```

As `t` increases:
- **Spawn interval** shrinks (`950ms → 320ms`) → more items.
- **Fall speed** rises (`180 → 760 px/s`) — gentle at the start so early food is
  reactable.
- **Type mix** shifts: activity gets **rarer** (`0.18 → 0.06`), food gets more
  **frequent** (`0.45 → 0.74`).

All values live in `src/config/gameConfig.ts → difficulty`.

## 5. Score
Score = survival time in seconds (shown live in the HUD and on Game Over). This
becomes the leaderboard metric and point basis in later passes.

## 5a. Starvation timer (added mechanic)

A radial **pie countdown** (top-right) forces the player to *eat*: catch a
**food or healthy** item before the timer runs out, or the game ends in
**starvation**.

- **Window scales with survival time** (longer early so slow-falling food can
  arrive, tighter later). Locked in at each meal, so it never jumps mid-countdown.
  Configured in `gameConfig.ts → starvation.tiers`:

  | Survival time | Eat within |
  |---|---|
  | 0–30s | 12s |
  | 30–45s | 10s |
  | 45–60s | 8s |
  | 60–70s | 6s |
  | 70s+ | 5s |
- Resets whenever the player **eats or drinks** — any **food** or **healthy**
  catch, **including air mineral** (water). Only **activity** (exercise) does
  *not* reset it. Rule: `def.type !== "activity"`.
- Under `warnSeconds` (2s) it turns red, pulses, and the label flips to "MAKAN!".
- **Two loss states now:** HP → 0 (overeating / "Kalori berlebih") and
  starvation → 0 ("Kelaparan!"). Both end the run; score is still survival time.

**Why it's here:** it removes the "dodge-everything immortality" weakness — you
must eat periodically. Eating **healthy** keeps you alive cheaply (small HP
cost), while junk food also resets it but costs a lot of HP, so the smart play is
"eat healthy, catch activity to recover." Configurable/can be disabled via
`starvation.enabled`.

## 6. Balance notes & risks (for PM/design)

- **"Avoid-everything" risk:** because HP only changes on catch (per spec), a
  perfect player can in theory dodge all food early and never lose HP. The
  difficulty ramp (density + speed) is what eventually makes total avoidance
  impossible, forcing HP erosion and making activity items valuable. Validate
  the `tauSeconds`, spawn, and speed curves in playtests.
- **Optional safety knob:** `passiveHpDrainPerSec` in `gameConfig` (default `0`,
  spec-accurate) can introduce a slow constant HP drain if playtests show the
  early game is too passive. Turn it on only if needed.
- **Tuning is data, not code:** rebalancing = editing `gameConfig.ts` /
  `itemConfig.ts`. No gameplay code changes required.

## 7. Out-of-scope dependencies (blocking later stories)
- LAPER **signed token** contract (identity for tokens/leaderboard/ownership).
- Separate **Supabase** project for the game DB (tokens, points, leaderboard,
  cosmetic ownership, personal records).
- LAPER → token-grant rules (first meal of day, all four categories) live in
  LAPER; the game reads balances/grants server-side.
