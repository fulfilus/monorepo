declare namespace google.maps {
  namespace places {
    // Legacy — kept for reference but replaced by PlaceAutocompleteElement
    class Autocomplete {
      constructor(input: HTMLInputElement, options?: AutocompleteOptions);
      getPlace(): PlaceResult;
      addListener(event: string, handler: () => void): void;
    }
    interface AutocompleteOptions {
      types?: string[];
      componentRestrictions?: { country: string | string[] };
      fields?: string[];
    }
    interface PlaceResult {
      formatted_address?: string;
      geometry?: { location: { lat(): number; lng(): number } };
      name?: string;
    }

    // New Places API
    class PlaceAutocompleteElement extends HTMLElement {
      constructor(options?: PlaceAutocompleteElementOptions);
      addEventListener(
        type: "gmp-select",
        handler: (e: PlaceAutocompletePlaceSelectEvent) => void,
        options?: boolean | AddEventListenerOptions,
      ): void;
      addEventListener(
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ): void;
    }
    interface PlaceAutocompleteElementOptions {
      requestedLanguage?: string;
      requestedRegion?: string;
      types?: string[];
    }
    interface PlaceAutocompletePlaceSelectEvent extends Event {
      placePrediction: PlacePrediction;
    }
    interface PlacePrediction {
      toPlace(): Place;
    }
    class Place {
      fetchFields(options: { fields: string[] }): Promise<{ place: Place }>;
      formattedAddress?: string;
      displayName?: string;
      location?: { lat(): number; lng(): number };
    }
  }
}
