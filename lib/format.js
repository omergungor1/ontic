export function formatPrice(value) {
  if (value === undefined || value === null || value === "") return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function truncate(text, max = 140) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export const PRODUCER_ORDER_STATUS = {
  created: "Oluşturuldu",
  confirmed: "Onaylandı",
  ready: "Hazır",
  shipped: "Kargolandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  rejected: "Reddedildi",
};

export const INTERNAL_ORDER_STATUS = {
  pending_assignment: "Dağıtım bekliyor",
  partially_assigned: "Kısmen dağıtıldı",
  assigned: "Dağıtıldı",
  cancelled: "İptal",
  completed: "Tamamlandı",
};
