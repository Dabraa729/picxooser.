// W przeglądarce nie ma AdMob — aplikacja pokazuje własną planszę „REKLAMA (demo)”.
export const hasNativeAds = false;
export async function initAds(): Promise<void> {}
export function showAd(): Promise<void> { return Promise.resolve(); }
