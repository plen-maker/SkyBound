# SkyBound EFB

Electronic Flight Bag for MSFS — shortcuts, SimBrief, élő térkép, controller axis konfig és push értesítések.

## Repo struktúra
```
skybound/
├── .github/workflows/build.yml   # auto-build: .dmg + .exe minden push-ra
├── bridge/                       # Windows host: SimConnect → Firebase RTDB
├── desktop/                      # Electron app (Mac .dmg + Win .exe)
├── mobile/                       # Expo app (iOS + Android)
├── shared/                       # SimBrief parser (közös)
└── firebase/                     # Firestore rules + config
```

## Build
Push to `main` → GitHub Actions épít .dmg és .exe-t automatikusan.
Tag (`v0.1.0`) → GitHub Release jön létre a binárisokkal.

### Lokális build (Mac, .dmg)
```bash
cd desktop && npm install && npm run dist:mac
```
### Lokális build (Windows, .exe)
```bash
cd desktop && npm install && npm run dist:win
```
