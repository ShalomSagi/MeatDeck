export function OutputPick({ value, onChange }: { value: "json" | "text"; onChange: (v: "json" | "text") => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as "json" | "text")}
      className="h-7 w-28 rounded-md border border-input bg-popover px-2 text-xs dark:bg-input/32"
    >
      <option value="json">Output: JSON</option>
      <option value="text">Output: text</option>
    </select>
  );
}
