export default function CargoCompanySelect({
  companies,
  value,
  onChange,
  className = "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm",
}) {
  const visible = (companies || []).filter(
    (company) => company.is_active !== false || company.id === value
  );

  return (
    <select
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="">Kargo firması seçilmemiş</option>
      {visible.map((company) => (
        <option key={company.id} value={company.id}>
          {company.name}
          {company.is_active === false ? " (pasif)" : ""}
        </option>
      ))}
    </select>
  );
}
