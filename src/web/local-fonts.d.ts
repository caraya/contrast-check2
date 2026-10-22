export {};

declare global {
  interface LocalFontFaceData {
    family: string;
    fullName: string;
    postscriptName: string;
    style: string;
    blob(): Promise<Blob>;
  }

  interface Window {
    queryLocalFonts?: () => Promise<LocalFontFaceData[]>;
  }
}
