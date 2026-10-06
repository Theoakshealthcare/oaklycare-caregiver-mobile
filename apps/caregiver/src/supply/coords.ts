import type * as Location from "expo-location";

import type { Coords } from "./locationService";

export function coordsFromLocation(location: Location.LocationObject): Coords {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    heading: location.coords.heading,
    speed: location.coords.speed,
  };
}
