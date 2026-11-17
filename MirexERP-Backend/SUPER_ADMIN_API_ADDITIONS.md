# Super Admin API additions

All routes below require `Authorization: Bearer <SUPER_ADMIN_ACCESS_TOKEN>`.

## Plans
- GET `/api/v1/platform/plans`
- POST `/api/v1/platform/plans` body: `{ name, code, monthlyPrice, yearlyPrice, description?, quarterlyPrice?, halfYearlyPrice?, currency?, features?, maxStudents?, maxStaff?, isActive?, sortOrder? }`
- PATCH `/api/v1/platform/plans/:id`
- DELETE `/api/v1/platform/plans/:id` (blocked while linked subscriptions exist)

## Revenue (subscription-payment records only)
- GET `/api/v1/platform/revenue?page=1&limit=20&paymentStatus=PAID&schoolId=<id>`
- Uses existing Subscription records where `paymentStatus=PAID`. No payment gateway settlement ledger is created.

## Platform users
- GET `/api/v1/platform/users?page=1&limit=20&search=&role=&status=`
- PATCH `/api/v1/platform/users/:id` body allows `name`, `phone`, `status`, `isActive`, `permissions`
- DELETE `/api/v1/platform/users/:id` performs soft-delete. Last active Super Admin cannot be deactivated.

## Platform roles
- GET `/api/v1/platform/roles`
- POST `/api/v1/platform/roles` body: `{ name, code, description?, permissions? }`
- PUT `/api/v1/platform/roles/:id/permissions` body: `{ permissions: string[] }`
- DELETE `/api/v1/platform/roles/:id` (system roles blocked)

## Support tickets
- GET `/api/v1/platform/support-tickets?page=1&limit=20&status=&priority=&category=&schoolId=`
- POST `/api/v1/platform/support-tickets` body: `{ subject, description, schoolId?, category?, priority? }`
- PATCH `/api/v1/platform/support-tickets/:id` body allows `status`, `priority`, `assignedTo`, `category`, `message`

## Platform settings
- GET `/api/v1/platform/settings`
- PATCH `/api/v1/platform/settings` body: `{ values: { ... } }`

## Audit logs
- GET `/api/v1/platform/audit-logs?page=1&limit=20&action=&entity=&actorRole=&from=&to=`

## Existing routes confirmed in source
- Dashboard: `/api/v1/dashboard/super-admin/{overview,schools-statistics,revenue-statistics,recent-activities}`
- Schools: GET/POST `/api/v1/schools`, GET/PATCH/DELETE `/api/v1/schools/:id`, PATCH `/api/v1/schools/:id/status`
- School list already accepts `page`, `limit`, `search`, `status`, and `city`.

## Important implementation boundary
This adds platform CRUD APIs and MongoDB models, not a payment gateway integration, email notification workflow, ticket SLA engine, permission enforcement engine for custom roles, or UI pages. Those require separate integration/testing. API presence is not a Postman PASS; verify against the running database.
