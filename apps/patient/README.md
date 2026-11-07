# Oakly Health (patient app)

Expo SDK 57 / React Native 0.86 app for patients and families. This is the foundation shell
(login, placeholder home, logout); the old app's screens are ported in later slices.
See `docs/sop/2026-11-07-patient-app-foundation.md` and the Patient app section of `docs/checklist/README.md`.

```bash
cp .env.example .env.local     # EXPO_PUBLIC_API_URL = backend origin, no /api/v1
pnpm --filter oaklycare-patient-mobile start
pnpm --filter oaklycare-patient-mobile typecheck | lint | test
```

Native projects are generated (`expo prebuild`); there is no `android/` or `ios/` folder and no signing material in git.
