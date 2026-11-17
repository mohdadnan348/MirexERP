# MirexERP Web Frontend

Next.js 15 + React 19 + TypeScript web console for MirexERP.

## Local setup

1. Start the MirexERP backend on port `5000`.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_API_URL` to the backend API prefix (default `http://localhost:5000/api/v1`).
4. Install packages with `npm install`.
5. Start the frontend with `npm run dev`.

## Backend integration

- Login uses `POST /auth/login`; access and refresh tokens are stored in session storage.
- The API client attaches the access token and attempts refresh-token rotation through `POST /auth/refresh-token` after a 401 response.
- Dashboard metrics use `/dashboard/overview`, `/dashboard/attendance`, `/dashboard/fees`, and `/dashboard/activities`.
- Module pages are connected to the corresponding backend list/create/update/delete routes. Nested modules use their actual collection endpoints: fee invoices (`/fees/invoices`), finance income (`/finance/income`), and library books (`/library/books`).
- List pages request `page`, `limit`, and `search`; server-side validation and role permissions remain authoritative.
- JSON form fields accept valid JSON for nested backend fields. MongoDB ObjectId references must be selected/entered using IDs returned by the backend.

## Important notes

- The UI does not seed or fabricate records. Empty states mean the API returned no records.
- Backend role authorization can return 403 when the signed-in role is not permitted to access an operation.
- Some complex workflows are represented by their core collection screen in this integration pass. Special actions such as admission approval/rejection, bulk attendance, fee payment/discount/refund processing, transport assignment, book issue/return, payroll processing and report exports still need dedicated workflow screens.
- Verify all forms against the backend validation schemas and test with real school records before production use.
