/** Decorative brick wall that lays itself course by course. Purely visual. */
const COLS = 9;
const ROWS = 9;
const W = 120;
const H = 48;
const GAP = 6;

// Orange accents, as [row, col] from the top. Hand-placed so the pattern stays stable.
const ACCENT = new Set(["3-4", "5-2", "5-3", "6-6", "7-1", "7-5", "8-3", "8-4"]);

export function BrickWall({ className = "" }: { className?: string }) {
  const bricks: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    const offset = r % 2 === 0 ? 0 : -(W + GAP) / 2;
    for (let c = 0; c <= COLS; c++) {
      const x = c * (W + GAP) + offset;
      const y = r * (H + GAP);
      const key = `${r}-${c}`;
      const accent = ACCENT.has(key);
      const shade = (r * 7 + c * 13) % 3;
      const fill = accent ? "#f58b1e" : shade === 0 ? "#383a40" : shade === 1 ? "#33353b" : "#3d3f46";
      bricks.push(
        <rect
          key={key}
          className="brick"
          style={{ animationDelay: `${(ROWS - r) * 110 + c * 45}ms`, transformOrigin: `${x + W / 2}px ${y + H / 2}px` }}
          x={x}
          y={y}
          width={W}
          height={H}
          rx={3}
          fill={fill}
        />,
      );
    }
  }
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${COLS * (W + GAP)} ${ROWS * (H + GAP)}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      {bricks}
    </svg>
  );
}
