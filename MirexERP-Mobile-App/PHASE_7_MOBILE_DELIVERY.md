# Phase 7 — Mobile Application Delivery

Status: **IMPLEMENTED — TESTING PENDING**. This delivery improves the existing Expo app; it is not a production certification.

## Implemented in this increment
- Persist access, refresh and user session values with Expo SecureStore.
- Restore the saved session and rotate tokens through `POST /auth/refresh-token` when the access token is absent.
- Call the backend logout endpoint and clear local session credentials.
- Replace fabricated dashboard percentages/homework counts and hard-coded greeting with live `/dashboard/overview` data and honest loading/error states.
- Add role-specific dashboard shortcuts for Parent and Teacher.
- Replace profile placeholder with authenticated user information and a confirmed sign-out action.
- Keep existing Parent/Teacher/Student routes, service modules and shared API client.

## Important limitations
- The current `/dashboard/overview` backend endpoint is school-staff dashboard data, not a verified parent/student personal dashboard. Mobile dashboard values are therefore rendered only when matching aggregate fields are returned; unknown metrics show `—`. It must not be treated as a fully scoped parent/student dashboard.
- Parent child-switching endpoint is not available to Parent role in the current backend route permissions; the mobile child-switcher remains blocked until a relationship-scoped parent endpoint is implemented.
- Teacher attendance and homework screens still require assignment-scoped mobile workflows and backend integration verification.
- Push token registration/delivery, native online checkout, offline draft synchronization conflict handling and PDF viewer flows require end-to-end testing/configuration.
- Expo SDK 52 / React Native 0.76 versions are preserved as requested; no dependency upgrades were performed.

## Tests
- Source/package JSON validation and archive integrity are executed for this delivery.
- Expo typecheck, Android build, device tests and live API integration tests are pending because a clean dependency installation and connected school test environment are not available in this execution.
