interface HeaderProps {
  // When omitted (e.g. the shared-place page / share screen) the location
  // indicator is hidden and only the brand shows.
  cityLabel?: string | null;
  onChangeLocation?: () => void;
}

function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export function Header({ cityLabel, onChangeLocation }: HeaderProps) {
  return (
    <div className="header">
      <div className="header-brand">
        <div className="header-logo">W</div>
        <div className="header-titles">
          <div className="header-title">WSIGTE</div>
          <div className="header-tagline">Where Should I Go To Eat?</div>
        </div>
      </div>

      {onChangeLocation && (
        <button
          type="button"
          className="header-location"
          onClick={onChangeLocation}
          aria-label="Change location"
        >
          <PinIcon size={14} />
          <span className="header-location-label">
            {cityLabel ?? "Locating…"}
          </span>
        </button>
      )}
    </div>
  );
}
