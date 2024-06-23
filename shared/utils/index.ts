export function getPlaceKey(place: mapkit.Place) {
    return place.formattedAddress + place.name;
  }
  

export function* createUniqueRandomGenerator(
  places: mapkit.Place[],
  seen: Set<string>
) {
  const available = places;

  const randomIndex = Math.floor(Math.random() * available.length);
  const place = available[randomIndex];
  while (!seen.has(getPlaceKey(place))) {
    available.splice(randomIndex, 1);
    seen.add(place.formattedAddress + place.name);
    yield place;
  }
  return undefined;
}