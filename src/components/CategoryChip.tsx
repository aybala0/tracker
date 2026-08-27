import { CAT_COLOR } from "../constants/categories";
import { fg } from "../utils/color";

type Props = {
  name: string;
  active: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
};

/** A category chip: locked to the category's fixed color when selected, matching the pie slice / drill-down tag for that category everywhere. */
export function CategoryChip({ name, active, onClick, size = "md" }: Props) {
  const color = CAT_COLOR[name] ?? "#111";
  const bg = active ? color : "#fff";
  const textColor = active ? fg(color) : "#2d2b2b";
  const dot = active ? textColor : color;
  const border = active ? "#000" : "rgba(0,0,0,.22)";
  const weight = active ? 700 : 500;
  const minHeight = size === "sm" ? 32 : 36;
  const fontSize = size === "sm" ? 12.5 : 13;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={{
        minHeight,
        padding: "0 12px",
        border: `1.5px solid ${border}`,
        background: bg,
        color: textColor,
        display: "flex",
        alignItems: "center",
        gap: 7,
        font: `${weight} ${fontSize}px Archivo`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ width: 9, height: 9, background: dot, flexShrink: 0 }} />
      {name}
    </div>
  );
}
