export type ItemType = "food" | "healthy" | "activity";

export interface ItemDef {
  key: string;
  type: ItemType;
  asset: string;
  value: number;
  label: string;
}

export const ITEMS: ItemDef[] = [
  { key: "food_bakso", type: "food", asset: "assets/items/food/bakso.png", value: 300, label: "Bakso" },
  { key: "food_seblak", type: "food", asset: "assets/items/food/seblak.png", value: 350, label: "Seblak" },
  { key: "food_mie_goreng", type: "food", asset: "assets/items/food/mie_goreng.png", value: 380, label: "Mie Goreng" },
  { key: "food_nasi_padang", type: "food", asset: "assets/items/food/nasi_padang.png", value: 450, label: "Nasi Padang" },
  { key: "food_donat", type: "food", asset: "assets/items/food/donat.png", value: 250, label: "Donat" },
  { key: "food_es_teh", type: "food", asset: "assets/items/food/es_teh.png", value: 70, label: "Es Teh" },

  { key: "healthy_pisang", type: "healthy", asset: "assets/items/healthy/pisang.png", value: 105, label: "Pisang" },
  { key: "healthy_alpukat", type: "healthy", asset: "assets/items/healthy/alpukat.png", value: 240, label: "Alpukat" },
  { key: "healthy_brokoli_rebus", type: "healthy", asset: "assets/items/healthy/brokoli_rebus.png", value: 55, label: "Brokoli Rebus" },
  { key: "healthy_apel", type: "healthy", asset: "assets/items/healthy/apel.png", value: 50, label: "Apel" },
  { key: "healthy_telur_rebus", type: "healthy", asset: "assets/items/healthy/telur_rebus.png", value: 70, label: "Telur Rebus" },
  { key: "healthy_wortel", type: "healthy", asset: "assets/items/healthy/wortel.png", value: 40, label: "Wortel" },
  { key: "healthy_air_mineral", type: "healthy", asset: "assets/items/healthy/air_mineral.png", value: 0, label: "Air Mineral" },

  { key: "activity_jogging_5", type: "activity", asset: "assets/items/activity/jogging_5.png", value: 40, label: "Jogging 5 mnt" },
  { key: "activity_jogging_30", type: "activity", asset: "assets/items/activity/jogging_30.png", value: 240, label: "Jogging 30 mnt" },
  { key: "activity_angkat_beban_15", type: "activity", asset: "assets/items/activity/angkat_beban_15.png", value: 85, label: "Angkat Beban 15 mnt" },
  { key: "activity_yoga_30", type: "activity", asset: "assets/items/activity/yoga_30.png", value: 100, label: "Yoga 30 mnt" },
  { key: "activity_bersepeda_15", type: "activity", asset: "assets/items/activity/bersepeda_15.png", value: 115, label: "Bersepeda 15 mnt" },
  { key: "activity_bersepeda_45", type: "activity", asset: "assets/items/activity/bersepeda_45.png", value: 350, label: "Bersepeda 45 mnt" },
];

export const ITEMS_BY_TYPE: Record<ItemType, ItemDef[]> = {
  food: ITEMS.filter((i) => i.type === "food"),
  healthy: ITEMS.filter((i) => i.type === "healthy"),
  activity: ITEMS.filter((i) => i.type === "activity"),
};
