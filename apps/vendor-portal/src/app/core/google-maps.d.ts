declare namespace google.maps {
  namespace places {
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
  }
}
