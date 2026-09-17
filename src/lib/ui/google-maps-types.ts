/**
 * Minimal typings of the Google Maps Places Autocomplete API used by the
 * address inputs (src/components/ui/AddressAutocomplete*.tsx). The script is
 * loaded on demand, so `window.google` is optional and typed here once.
 */

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GooglePlaceResult = {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
};

export type GoogleAutocompleteOptions = {
  types: string[];
  componentRestrictions: { country: string };
  fields: string[];
};

export type GoogleAutocomplete = {
  addListener: (eventName: "place_changed", handler: () => void) => void;
  getPlace: () => GooglePlaceResult | undefined;
};

export type GoogleMapsEventApi = {
  clearInstanceListeners: (instance: object) => void;
};

export type GoogleMapsGlobal = {
  maps?: {
    event?: GoogleMapsEventApi;
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: GoogleAutocompleteOptions
      ) => GoogleAutocomplete;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsGlobal;
  }
}
