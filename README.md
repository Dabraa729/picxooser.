# PicXooser na iPhone'a

Wersja mobilna PicXooser (React Native / Expo): znajduje podobne zdjęcia i filmy
w bibliotece iPhone'a i rozstrzyga każdą grupę drabinką „każdy z każdym”.
Zwycięzca zostaje, resztę możesz usunąć (trafia do „Ostatnio usunięte”).

**Stan:** wersja 0.1. Logika ma testy, interfejs był sprawdzany w przeglądarce
na danych demo. Na prawdziwym iPhonie jeszcze nie była uruchamiana.

## Jak to trafia na telefon (bez Maca)

1. Kod leży w repozytorium na GitHubie.
2. GitHub Actions kompiluje go na Macu w chmurze i wystawia plik `PicXooser.ipa`
   (zakładka **Actions** → ostatnie uruchomienie → **Artifacts**). Dla publicznego
   repozytorium jest to bezpłatne.
3. Plik `.ipa` podpisujesz swoim Apple ID i instalujesz kablem z komputera.

### Instalacja z CachyOS (darmowe Apple ID)

```bash
sudo pacman -S --needed usbmuxd flatpak
flatpak install flathub dev.khcrysalis.PlumeImpactor
```

1. Podłącz iPhone'a kablem, odblokuj go i wybierz **Zaufaj temu komputerowi**.
2. Dopiero wtedy uruchom Impactor (jeśli nie widzi telefonu: zamknij go,
   sprawdź kabel i uruchom ponownie przy podłączonym telefonie).
3. W ustawieniach Impactora zaloguj się Apple ID, zaimportuj `PicXooser.ipa`
   i zainstaluj na telefonie.
4. Na iPhonie: **Ustawienia → Ogólne → VPN i zarządzanie urządzeniem** → zaufaj
   swojemu Apple ID. Jeśli system o to poprosi, włącz też **Tryb dewelopera**
   (Ustawienia → Prywatność i ochrona) i uruchom telefon ponownie.

Ograniczenia darmowego konta: podpis jest ważny 7 dni (potem instalujesz
ponownie tym samym plikiem, dane aplikacji zostają) i można mieć tylko kilka
takich aplikacji naraz. Impactor loguje się Twoim Apple ID do serwerów Apple;
wiele osób zakłada do tego osobne Apple ID.

Płatne konto Apple Developer (99 USD rocznie) daje instalację przez TestFlight
bez kabla i jest wymagane do publikacji w App Store.

## Podgląd w przeglądarce (dane demo)

```bash
npm install
npm run web
```

Tryb demo ma sztuczną bibliotekę, więc można przejść cały przepływ bez telefonu.

## Co jest w środku

| Plik | Rola |
|---|---|
| `src/logic/` | hash zdjęć, grupowanie, drabinka z dogrywką (`npm test`) |
| `src/media.ts` | biblioteka zdjęć iPhone'a; `media.web.ts` to dane demo |
| `src/scan.ts` | skanowanie z pamięcią hashy między uruchomieniami |
| `src/screens/` | Start, Pojedynek, Drabinka, Wynik |
| `src/ads.ts` | reklama pełnoekranowa co 5 rozstrzygniętych grup |
| `.github/workflows/ios.yml` | budowanie `.ipa` w chmurze |

## Reklamy

Aplikacja używa testowych identyfikatorów Google, więc pokazuje reklamy próbne.
Przed publikacją trzeba założyć konto AdMob i podmienić `UNIT_ID` w `src/ads.ts`
oraz `iosAppId` w `app.json`.

## Znane ograniczenia wersji 0.1

- Zdjęcia i filmy, których oryginał jest tylko w iCloud, są pomijane.
- Pierwszy skan jest wolny (każde zdjęcie trzeba zdekodować); kolejne korzystają
  z zapamiętanych hashy. Domyślny zakres to 1000 najnowszych plików.
- Nie pokazuje rozmiaru plików w MB ani zwolnionego miejsca.
- Ikony przycisków to znaki tekstowe, a czcionka jest systemowa.
