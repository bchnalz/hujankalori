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

## 2b. Visual style

- **Theme** (`src/config/theme.ts`): one palette (night blues, green / gold /
  red accents) and two self-hosted fonts — **Lilita One** for titles, numbers,
  buttons and callouts (matches the logo and the promo flyer) and **Plus Jakarta
  Sans** for UI text. Fonts load before the first scene.
- **Backdrop** (`src/ui/Backdrop.ts`): procedural rainy night city drawn into
  canvas textures once — sky gradient with city glow and a hazy moon, drifting
  clouds, far/near skylines with lit windows (a few flicker) and a hospital with
  a glowing red cross, and a wet street with puddles, reflections and rain
  ripples. Lightning bolts strike behind the buildings.
- **IGD backdrop** (default, `BACKDROP = "hospital"` in `src/config/theme.ts`):
  the RSUD emergency building at night in the same style — cream facade with
  glowing wavy blue window bands, red neon "IGD", blue glass wing with red floor
  stripes and the "Accident & Emergency Department" sign, orange ground-floor
  band, the tensile drop-off canopy, a parked ambulance with a flashing red/blue
  light bar, plants and a street lamp. The building gets a 60% night shade
  (`?dark=0..0.95` previews other levels) with the neon, lamp and siren kept lit;
  the ambulance sits deeper in shadow and its siren is small, dim and slow so it
  never competes with the player or the items.
- **Three RSUD scenes by time of day** (WIB), picked once per session and kept
  for every screen:
  - 05–11 **GPT** (pagi mendung) — the classical main building (maroon hip roof with
    dormers, two domed corner towers, arched windows, iron balconies) under a
    dark overcast sky, ~40% shade (`?mdark=`), a few warm lit rooms, mist.
  - 11–18 **Taman (versi 2015)** (sore hujan) — the central garden in the middle of the hospital: cypress trees, the ward building
    with a red cross, the pendopo with red lanterns, shade trees, a log planter,
    river stones, a wet lawn, and the "RSUD SIDOARJO" letter monument in the
    middle (Bebas Neue: tall charcoal RSUD with cream SIDOARJO pairs in front,
    feet hidden by shrubs), ~40% shade (`?gdark=`).
  - 18–05 **IGD** (malam) — the IGD scene above.
  The menu's **PILIH LOKASI BERMAIN** button opens a popup carousel
  (`src/ui/LocationPicker.ts`): one card per option (Otomatis / IGD / GPT /
  Taman (versi 2015)) with a live thumbnail of the scene, its time slot,
  swipe or left/right arrows, page dots and a PILIH button; slide, bump,
  open/close and confirm all have SFX. The choice is saved per device
  (`hk_backdrop`). `?bg=city|hospital|morning|garden` overrides it.
- **Character** (`src/objects/CharacterArt.ts`): larger art (176 px) with a
  drawn face that follows the idle bob and reacts — happy (activity), chewing
  (healthy), shocked + red flash (heavy food), panicking with a sweat drop when
  the hunger timer is low; dizzy or bloated on game over. It leans into movement
  and squashes on catches. The catch hitbox is unchanged (`Player` is an
  invisible physics zone carrying the art).
- **Item glow** (`src/systems/ItemGlow.ts`): every falling item has a
  neon-emissive outline colour-coded by type — green activity, gold healthy,
  red-orange heavy food — with a soft halo that pulses slowly, a few light sparks
  and a faint light trail. Glow textures are baked once per item, so it costs one
  extra image per item and works without WebGL; it is synced after physics so it
  never lags behind the item.
- **Particles** (`src/ui/Fx.ts`): star bursts for good catches, red bits and
  crumbs for heavy food, splashes when items hit the street, confetti on a new
  record; items pop in as they appear.
- **HUD** (`src/ui/Hud.ts`, `StarveGauge.ts`): one dark glass panel at the top —
  round sound/pause buttons on the left, the calorie gauge in the middle
  ("BATAS KALORI", big rolling number, 8 segments, a hatched red danger zone
  for the last 20%, green → amber → red by state) and the hunger donut as a
  neon ring on the right (LAPAR → MAKAN! when low). The survival timer is big
  and centred under the panel.
  - Drop: a light "melting" segment holds then drains, the bar shakes, red
    sparks chip off its end and "−N" pops under it (big drops add a soft SFX).
  - Gain: the bar grows smoothly with a shimmer sweep, green sparkles, "+N"
    and a short sparkle SFX.
  - Danger zone: the bar glow pulses and the label becomes "⚠ HAMPIR KENYANG!".
- **Uniforms** (`src/objects/CharacterSprite.ts`): the character is drawn
  procedurally in one of six RSUD uniforms — Bagian Umum, Dokter, Perawat OK
  (cap + mask; the face shows eyes only), Penunjang (navy, red sleeve piping),
  Batik (black with a white corona-virus motif, maroon outline) and Korpri
  (blue Korpri batik, gold pin on the left chest). Picked in a carousel popup
  from the menu (SERAGAM button), saved per device (`hk_uniform`).
- **Share card** (`src/ui/ShareCard.ts`): on Game Over, BAGIKAN builds a 3:4
  image (1080×1440) — achievement chip, score, location, the character in
  uniform on that scene, initials, the food caught with counts (no
  activities), QR + link — and opens the phone's share sheet with an
  automatic persuasive caption (also copied to the clipboard); SIMPAN
  downloads the image.
- **Catch feed** (bottom): a rounded card per catch — big item icon in a
  glowing badge, the name, its type (AKTIVITAS / MAKANAN SEHAT / MAKANAN
  BERAT) and the calorie change, all in the type colour; the previous card
  shrinks and dims below it.
- **Transitions**: scenes fade through night blue; the end of a run flashes and
  zooms onto the character before Game Over.
- **Buttons**: raised style with a darker base that the face presses into.

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
- **Briefing popup** (`src/ui/Briefing.ts`): before the countdown, the field
  dims while the real HUD stays lit; the popup also shows its own mini calorie
  bar and mini hunger donut next to each explanation. The calorie bar fills to full ("Ini adalah
  batas kalori harian Anda. Bila habis, perut Anda sudah kekenyangan!"), then the
  hunger donut pops in and drains in a quick demo before refilling ("Tapi jangan
  sampai nggak makan ya, nanti kamu pingsan!"), then a **SIAP!** button starts
  the countdown. Every motion has a sound. "MAIN LAGI" retries skip it.
- **Combo:** each activity or healthy item caught in a row raises a combo
  (COMBO xN above the player, a ring burst, a rising jingle and a badge under the
  timer); every 5th gets a big callout that always fits the screen: x5 "NTAP!", x10 "AURA FARMING!", x15 "LET HIM COOK!", x20 "KING!", x25 "MASIH LANJUT?!", x30 and beyond "G.O.A.T.!". Catching heavy food breaks
  it ("Combo putus!"). Visual/audio only — no score effect.
- **Catch feed:** the footer shows what was just caught (larger icon and text);
  the newest row is on top and the previous one slides down and dims, so quick
  catches never overlap. Floating "+/- kkal" texts stack upward when close.
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
