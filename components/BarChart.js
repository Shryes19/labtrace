// Simple single-series SVG column chart (server-rendered, hover via <title>)
export default function BarChart({ data, valueKey, labelKey, height = 220, format = (v) => v, color = '#2a78d6' }) {
  const W = 640, H = height, padL = 40, padB = 26, padT = 12;
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const bw = (W - padL) / data.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
            <text className="axis" x={padL - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0;
          const x = padL + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const h = Math.max(0, H - padB - y(v));
          return (
            <g key={i}>
              <path d={`M${x},${H - padB} v${-Math.max(h - 4, 0)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${Math.max(h - 4, 0)} z`}
                    fill={color} opacity={h ? 1 : 0}>
                <title>{`${d[labelKey]}: ${format(v)}`}</title>
              </path>
              <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent">
                <title>{`${d[labelKey]}: ${format(v)}`}</title>
              </rect>
              <text className="axis" x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle">{d[labelKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
