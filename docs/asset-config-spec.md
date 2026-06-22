# Asset Configuration Spec

All visuals are **swappable image files** loaded from `public/assets/`. Adding or
changing art requires **no gameplay code changes** — only files plus a small
config entry for new falling items.

## Folder structure

| Component | Folder | Notes |
|-----------|--------|-------|
| Base sprite (male) | `assets/player/base_male.png` | Sprite sheet, 4 frames of 128×128 |
| Base sprite (female) | `assets/player/base_female.png` | Same |
| Falling food items | `assets/items/food/` | One PNG per food type |
| Falling healthy items | `assets/items/healthy/` | One PNG per healthy type |
| Falling activity items | `assets/items/activity/` | One PNG per activity type |
| Background | `assets/background/bg.png` | 720×1280 |
| UI elements | `assets/ui/` | token, point, heart icons |
| Head / Hair / Clothes / Bottom / Shoes cosmetics | `assets/cosmetics/<slot>/` | Reserved for GAME-07+ (not loaded yet) |

## PNG sizes & dimensions

All PNGs are **transparent (RGBA, 32-bit)**, square where noted.

| Component | Author at (export size) | In-game display | Notes |
|-----------|------------------------|-----------------|-------|
| **Falling items** (food / healthy / activity) | **128 × 128 px** | 96 × 96 px | One PNG per item. Square. Centered subject with a little padding so the round hitbox (~84% of the frame) feels fair. |
| Player base sheet (male/female) | **512 × 128 px** = 4 frames of **128 × 128** | 128 × 128 | Horizontal sprite sheet, 4 equal frames (idle/move). |
| Background | **720 × 1280 px** | full screen | Portrait. Static or layered. |
| UI icons (token, point, heart) | **64 × 64 px** | 64 × 64 | — |
| Cosmetics (Head/Hair/Clothes/Bottom/Shoes — future) | **128 × 128 px** | matches player | Must share the 128×128 base-sprite canvas + anchor so layers align. |

> Falling items are authored at 128×128 for crispness/consistency with the
> player and cosmetic canvas, and the game scales them to 96×96 automatically.
> Any square size works, but **128×128 is the standard** — please use it.

## Falling item components (the "raining" items)

These are every item that currently falls. Drop the final PNG at the exact path,
keeping the same filename. All are **128 × 128 px transparent PNG**.

### Food — high-calorie (catching **drains** HP by its value)

| In-game label | File path | Config key | HP effect |
|---------------|-----------|------------|-----------|
| Bakso | `assets/items/food/bakso.png` | `food_bakso` | −300 |
| Seblak | `assets/items/food/seblak.png` | `food_seblak` | −350 |
| Mie Goreng | `assets/items/food/mie_goreng.png` | `food_mie_goreng` | −380 |
| Nasi Padang | `assets/items/food/nasi_padang.png` | `food_nasi_padang` | −450 |
| Donat | `assets/items/food/donat.png` | `food_donat` | −250 |
| Es Teh | `assets/items/food/es_teh.png` | `food_es_teh` | −70 |

### Healthy — sayur/buah/minuman (catching drains a **small** HP; can be **0/neutral**)

| In-game label | File path | Config key | HP effect |
|---------------|-----------|------------|-----------|
| Pisang | `assets/items/healthy/pisang.png` | `healthy_pisang` | −105 |
| Alpukat | `assets/items/healthy/alpukat.png` | `healthy_alpukat` | −240 |
| Brokoli Rebus | `assets/items/healthy/brokoli_rebus.png` | `healthy_brokoli_rebus` | −55 |
| Apel | `assets/items/healthy/apel.png` | `healthy_apel` | −50 |
| Telur Rebus | `assets/items/healthy/telur_rebus.png` | `healthy_telur_rebus` | −70 |
| Wortel | `assets/items/healthy/wortel.png` | `healthy_wortel` | −40 |
| Air Mineral | `assets/items/healthy/air_mineral.png` | `healthy_air_mineral` | 0 (neutral) |

> Healthy items use **per-item** values (`value` in `itemConfig.ts`). Set
> `value: 0` for a neutral item like air mineral (no HP change on catch).

### Activity — olahraga (catching **restores** HP by its value)

| In-game label | File path | Config key | HP effect |
|---------------|-----------|------------|-----------|
| Jogging 5 mnt | `assets/items/activity/jogging_5.png` | `activity_jogging_5` | +40 |
| Jogging 30 mnt | `assets/items/activity/jogging_30.png` | `activity_jogging_30` | +240 |
| Angkat Beban 15 mnt | `assets/items/activity/angkat_beban_15.png` | `activity_angkat_beban_15` | +85 |
| Yoga 30 mnt | `assets/items/activity/yoga_30.png` | `activity_yoga_30` | +100 |
| Bersepeda 15 mnt | `assets/items/activity/bersepeda_15.png` | `activity_bersepeda_15` | +115 |
| Bersepeda 45 mnt | `assets/items/activity/bersepeda_45.png` | `activity_bersepeda_45` | +350 |

All HP values live in `src/config/itemConfig.ts` and can be rebalanced freely.

## Adding a new falling item
1. Drop a **128 × 128** transparent PNG into the matching folder,
   e.g. `assets/items/food/nasi_goreng.png`.
2. Register it in `src/config/itemConfig.ts`:
   ```ts
   { key: "food_nasgor", type: "food", asset: "assets/items/food/nasi_goreng.png", value: 280, label: "Nasi Goreng" }
   ```
3. Done — the preloader and spawner pick it up automatically. `value` is the HP
   cost (food/healthy) or HP restore (activity). Use `value: 0` for a neutral
   item (e.g. air mineral).

## Naming convention
- lowercase, underscore-separated: `burger.png`, `running_shoe.png`,
  `head_01.png`.
- Prefix rare/unlockable cosmetics with `rare_` (organizational only; does not
  affect logic).

## Replacing placeholder art
The placeholder generator (`npm run assets`) is **non-destructive**: it only
creates a PNG when one is **missing**, and **skips any file that already
exists**. So your real artwork is safe — `predev`/`prebuild` will never
overwrite it.

To ship real art:
1. Drop the final PNG at the same path (same filename) — it now takes priority
   over the placeholder permanently.
2. Commit it (and remove the `public/assets/` ignore line in `.gitignore` so real
   assets are tracked in git).

Other commands:
- **Regenerate one placeholder** (e.g. after renaming an item): delete that file,
  then run `npm run assets`.
- **Reset ALL placeholders** (overwrites everything, including real art): `npm run
  assets:force`. Use with care.

## Style guidance (for designers)
- Transparent-background PNGs; one consistent style (flat, pixel, or vector).
- Consistent outline thickness and palette saturation so layered cosmetics match.
- Preview combinations in an editor before handoff to catch misalignment early.
