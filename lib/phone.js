/** TR cep telefonu: 05XX XXX XX XX (11 hane) */

export const PHONE_REGEX = /^05\d{2} \d{3} \d{2} \d{2}$/;

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

/** Input sırasında formatlar; en fazla 11 hane, yalnızca 05 ile başlayan TR cep */
export function formatPhoneInput(value) {
  let digits = digitsOnly(value);

  if (!digits) return "";

  // 5XXXXXXXXX → 05XXXXXXXXX
  if (digits.startsWith("5")) {
    digits = `0${digits}`;
  }

  // 0 ile başlamıyorsa geçersiz karakterleri temizle
  if (!digits.startsWith("0")) {
    const fiveIndex = digits.indexOf("5");
    digits = fiveIndex >= 0 ? `0${digits.slice(fiveIndex)}` : "";
  }

  // İkinci hane 5 değilse sadece "0" bırak
  if (digits.length >= 2 && digits[1] !== "5") {
    digits = "0";
  }

  digits = digits.slice(0, 11);

  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`;
}

export function isValidTrMobile(value) {
  return PHONE_REGEX.test(String(value || "").trim());
}

/** Geçerliyse formatlı numarayı, değilse null döner */
export function normalizePhone(value, { required = false } = {}) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return required ? null : "";
  const formatted = formatPhoneInput(trimmed);
  return isValidTrMobile(formatted) ? formatted : null;
}
