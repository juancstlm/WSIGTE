export interface District {
  name: string;
  sub: string;
  city: string;
}

interface DistrictTileProps {
  district: District;
  index: number;
  onSelect: (district: District) => void;
}

function ArrowIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function DistrictTile({ district, index, onSelect }: DistrictTileProps) {
  return (
    <button
      type="button"
      className="district-tile"
      onClick={() => onSelect(district)}
    >
      <div className="district-tile-num">
        № {(index + 1).toString().padStart(2, "0")}
      </div>
      <div className="district-tile-city">{district.city}</div>
      <div className="district-tile-name">{district.name}</div>
      <div className="district-tile-foot">
        <div className="district-tile-sub">{district.sub}</div>
        <ArrowIcon size={14} color="var(--ink)" />
      </div>
    </button>
  );
}
