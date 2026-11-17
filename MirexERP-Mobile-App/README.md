# MirexERP Mobile App

Expo + React Native + TypeScript mobile app scaffold for Parent, Teacher and Student roles.

## Start

1. Install Node.js LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Run `npx expo start`.
5. Scan the QR code using Expo Go, or run `npm run android`.

## Styling convention

React Native does not natively load browser `.css` files. To keep every component's styling separate, each screen/component has its own `.styles.ts` file using React Native `StyleSheet`.

Examples:
- `LoginScreen.tsx` -> `LoginScreen.styles.ts`
- `AppHeader.tsx` -> `AppHeader.styles.ts`
- `AttendanceScreen.tsx` -> `AttendanceScreen.styles.ts`

## Branding\n\nThe Expo launcher icon and Android adaptive icon use the supplied MirexERP graduation-cap app icon in `assets/app-icon.png` and `assets/adaptive-icon.png`.\n\n## Roles

One installed app supports Parent, Teacher and Student accounts. The backend role returned after login decides the navigation and dashboard. Parent accounts can switch between linked children.

## API

Set `EXPO_PUBLIC_API_URL` to the Express API base URL. The Axios client and service modules are in `src/services/`.

## Notes

This is a runnable starter scaffold with sample dashboard data and placeholder screens. Connect and test the actual backend endpoints, payment gateway, push notification provider and offline attendance sync before production.
