export function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      className="h-7 rounded-md border border-input bg-popover px-1.5 text-xs tabular-nums dark:bg-input/32 dark:[color-scheme:dark]"
    />
  );
}
