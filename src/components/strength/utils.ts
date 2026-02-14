import { StrengthSessionItem } from "@/lib/api";

export const orderStrengthItems = (items: StrengthSessionItem[] = []) => {
  if (!items.length) return items;
  const indexed = items.map((item, index) => {
    const order = Number(item.order_index);
    return {
      item,
      index,
      order: Number.isFinite(order) ? order : null,
    };
  });
  const hasOrder = indexed.some((entry) => entry.order !== null);
  if (!hasOrder) return items;
  return indexed
    .sort((a, b) => {
      if (a.order === null && b.order === null) return a.index - b.index;
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      if (a.order === b.order) return a.index - b.index;
      return a.order - b.order;
    })
    .map((entry) => entry.item);
};
