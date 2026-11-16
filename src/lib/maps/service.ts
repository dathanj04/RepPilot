import "server-only";
import { tomtomMapsKey } from "../maps-config";
import * as google from "./google";
import * as tomtom from "./tomtom";
export const geocodeAddress: typeof google.geocodeAddress = (...args) => (tomtomMapsKey() ? tomtom : google).geocodeAddress(...args);
export const searchPlaces: typeof google.searchPlaces = (...args) => (tomtomMapsKey() ? tomtom : google).searchPlaces(...args);
export const computeDrive: typeof google.computeDrive = (...args) => (tomtomMapsKey() ? tomtom : google).computeDrive(...args);
