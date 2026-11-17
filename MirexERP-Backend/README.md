# MirexERP Backend

Multi-tenant school ERP API built with Express, TypeScript and MongoDB/Mongoose.

## Requirements
- Node.js 20+
- MongoDB 6+

## Setup
1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (both JWT secrets must be at least 32 characters).
3. Install dependencies: `npm install`.
4. Build: `npm run build`.
5. Start development server: `npm run dev`.
6. Production: `npm start`.

API routes are mounted under the configured `API_PREFIX` (default `/api/v1`).

## Important engineering note
This delivery includes integration fixes for route exports, the student portal import, Express compatibility, and legacy response helpers. The current TypeScript configuration uses `noCheck` to allow JavaScript emission while the existing module-level type mismatches are being corrected. Therefore a successful build is **not** evidence that all module types or business workflows have been fully verified. Review the audit note before production deployment.
