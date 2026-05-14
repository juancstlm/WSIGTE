import { DistrictTile, type District } from "./DistrictTile";

interface DistrictGridProps {
  districts: District[];
  onSelect: (district: District) => void;
}

export function DistrictGrid({ districts, onSelect }: DistrictGridProps) {
  return (
    <div className="district-grid">
      {districts.map((d, i) => (
        <DistrictTile
          key={d.name}
          district={d}
          index={i}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
