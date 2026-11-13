// Reklama pełnoekranowa (AdMob). Do czasu założenia konta AdMob używane są testowe identyfikatory Google.
import mobileAds, { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';

export const hasNativeAds = true;

// Przed publikacją: podmień na własny identyfikator jednostki reklamowej z AdMob
// (oraz iosAppId w app.json). Testowe ID pokazują tylko reklamy próbne.
const UNIT_ID = TestIds.INTERSTITIAL;

let ad: InterstitialAd | null = null;
let loaded = false;

function preload() {
  loaded = false;
  try {
    const next = InterstitialAd.createForAdRequest(UNIT_ID, { requestNonPersonalizedAdsOnly: true });
    next.addAdEventListener(AdEventType.LOADED, () => {
      if (ad === next) loaded = true;
    });
    next.addAdEventListener(AdEventType.ERROR, () => {
      if (ad === next) loaded = false;
    });
    ad = next;
    next.load();
  } catch {
    ad = null;
  }
}

export async function initAds(): Promise<void> {
  try {
    await mobileAds().initialize();
    preload();
  } catch {}
}

/** Pokazuje reklamę, jeśli jest wczytana; zawsze kończy się (także gdy reklamy brak). */
export function showAd(): Promise<void> {
  return new Promise((resolve) => {
    const current = ad;
    if (!current || !loaded) {
      preload();
      resolve();
      return;
    }
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      preload();
      resolve();
    };
    current.addAdEventListener(AdEventType.CLOSED, done);
    current.addAdEventListener(AdEventType.ERROR, done);
    try {
      current.show();
    } catch {
      done();
    }
  });
}
