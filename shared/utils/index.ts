export function getPlaceKey(place: mapkit.Place) {
  return place.formattedAddress + place.name;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function* createUniqueRandomGenerator(
  places: mapkit.Place[],
  seen: Set<string>
) {
  const shuffled = shuffle(places);
  for (const place of shuffled) {
    const key = getPlaceKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    yield place;
  }
  return undefined;
}