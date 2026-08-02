"use client";

import { formatPhoneInput, isValidTrMobile } from "@/lib/phone";

export default function PhoneInput({
  value,
  onChange,
  required = false,
  className = "w-full rounded-xl border px-3 py-2",
  placeholder = "05XX XXX XX XX",
  id,
  name = "phone",
}) {
  function handleChange(e) {
    onChange(formatPhoneInput(e.target.value));
  }

  const incomplete = value && !isValidTrMobile(value);

  return (
    <div>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        required={required}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={14}
        pattern="05[0-9]{2} [0-9]{3} [0-9]{2} [0-9]{2}"
        title="Telefon 05XX XXX XX XX formatında olmalıdır"
        className={className}
      />
      {incomplete ? (
        <p className="mt-1 text-xs text-rose-600">
          Geçerli format: 05XX XXX XX XX
        </p>
      ) : null}
    </div>
  );
}
