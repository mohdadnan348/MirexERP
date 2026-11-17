
# MirexERP API Conventions

## 1. Overview

This document defines API development standards for the MirexERP School Management System.

All backend modules must follow these conventions.

## 2. Base URL

Development:

```text
http://localhost:5000/api/v1
```

Production:

```text
https://api.yourdomain.com/api/v1
```

All API endpoints must use the `/api/v1` prefix.

## 3. URL Naming Convention

Use:
- Lowercase letters.
- Plural resource names.
- Hyphens for multi-word resources.
- Resource IDs for individual records.
- Nested routes only when there is a clear parent-child relationship.

Correct:

```text
/api/v1/students
/api/v1/academic-sessions
/api/v1/fee-structures
/api/v1/students/:studentId
```

Incorrect:

```text
/api/v1/GetStudents
/api/v1/student
/api/v1/feeStructures
```

## 4. HTTP Methods

| Method | Purpose |
|---|---|
| GET | Fetch records |
| POST | Create records or execute actions |
| PUT | Replace a complete resource |
| PATCH | Partially update a resource |
| DELETE | Delete or archive a resource |

Examples:

```http
GET    /api/v1/students
GET    /api/v1/students/:id
POST   /api/v1/students
PUT    /api/v1/students/:id
PATCH  /api/v1/students/:id
DELETE /api/v1/students/:id
```

## 5. Standard Success Response

Every successful API response must follow a consistent structure.

```json
{
  "success": true,
  "message": "Students fetched successfully",
  "data": [
    {
      "_id": "student_id",
      "admissionNumber": "MIR-2026-001",
      "firstName": "Rahul",
      "lastName": "Sharma",
      "status": "active"
    }
  ]
}
```

## 6. Single Record Response

```json
{
  "success": true,
  "message": "Student fetched successfully",
  "data": {
    "_id": "student_id",
    "firstName": "Rahul",
    "lastName": "Sharma"
  }
}
```

## 7. Created Response

Use HTTP status code `201`.

```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "_id": "student_id",
    "admissionNumber": "MIR-2026-001"
  }
}
```

## 8. Error Response

All errors must use a consistent response structure.

```json
{
  "success": false,
  "message": "Student not found",
  "errors": []
}
```

Validation error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "firstName",
      "message": "First name is required"
    },
    {
      "field": "dateOfBirth",
      "message": "Invalid date format"
    }
  ]
}
```

Never expose:
- Stack traces in production.
- Database credentials.
- JWT secrets.
- Internal server paths.
- Sensitive personal information.

## 9. HTTP Status Codes

| Status | Meaning |
|---|---|
| 200 | Successful request |
| 201 | Resource created |
| 204 | Successful request with no response body |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Resource not found |
| 409 | Conflict |
| 422 | Validation or business rule failure |
| 429 | Too many requests |
| 500 | Internal server error |
| 503 | Service unavailable |

## 10. Pagination

All list endpoints should support pagination.

Query parameters:

```text
?page=1&limit=10
```

Example:

```http
GET /api/v1/students?page=1&limit=10
```

Response:

```json
{
  "success": true,
  "message": "Students fetched successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalRecords": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Rules:

- Default page: 1
- Default limit: 10
- Maximum limit: 100
- Page and limit must be positive integers.
- Never allow unbounded list queries.

## 11. Search

Use a `search` query parameter.

Example:

```http
GET /api/v1/students?search=Rahul
```

Search should be limited to explicitly approved searchable fields.

## 12. Filtering

Use query parameters for filters.

Examples:

```http
GET /api/v1/students?status=active
GET /api/v1/students?classId=class_id
GET /api/v1/attendance?date=2026-11-10
GET /api/v1/fees?paymentStatus=pending
```

Never accept arbitrary MongoDB query operators directly from clients.

## 13. Sorting

Use `sortBy` and `sortOrder`.

Ascending:

```http
GET /api/v1/students?sortBy=firstName&sortOrder=asc
```

Descending:

```http
GET /api/v1/students?sortBy=createdAt&sortOrder=desc
```

Only allow sorting on approved fields.

## 14. Date and Time Format

Use ISO 8601 date and time formats.

Date:

```text
2026-11-10
```

Date and time:

```text
2026-11-10T10:30:00.000Z
```

School-local timezone should be considered for attendance, timetable, events and fee deadlines.

## 15. Authentication

Protected endpoints must require an access token.

Header:

```http
Authorization: Bearer ACCESS_TOKEN
```

Authentication rules:

- Validate access tokens on the server.
- Never trust user roles sent in request bodies.
- Derive identity and permissions from verified server-side authentication.
- Keep refresh tokens separate from access tokens.
- Rotate refresh tokens securely.
- Revoke refresh sessions on logout.

## 16. Role-Based Access Control

Supported roles:

### Platform Level

- SUPER_ADMIN

### School Level

- SCHOOL_ADMIN
- PRINCIPAL
- ACCOUNTANT
- RECEPTIONIST
- LIBRARIAN
- TRANSPORT_MANAGER

### Mobile App Roles

- PARENT
- TEACHER
- STUDENT

Every protected endpoint must check the required permission.

A valid login does not automatically grant permission to access every module.

## 17. Multi-Tenant API Rules

MirexERP is a multi-tenant SaaS platform.

Each school must access only its own records.

Rules:

1. Derive school context from verified authentication.
2. Do not trust `schoolId` from request body or query parameters for authorization.
3. Apply tenant filters to every school-owned database query.
4. Check tenant ownership before reading, updating or deleting a record.
5. Prevent cross-school references between students, parents, classes and employees.
6. Super Admin cross-tenant access must use explicitly authorized operations.
7. Test tenant isolation for every module.

Example:

```ts
const filter = {
  _id: studentId,
  schoolId: req.user.schoolId
};
```

This is an illustrative query pattern. Actual implementation must use the authenticated tenant context and handle platform-level access separately.

## 18. Soft Delete Convention

Use soft deletion for important school records where historical records must be preserved.

Suggested fields:

```json
{
  "isDeleted": false,
  "deletedAt": null,
  "deletedBy": null
}
```

Rules:

- Exclude deleted records from normal list queries.
- Restrict permanent deletion.
- Preserve financial and academic audit history.
- Record deletion actions in the audit log.

## 19. File Upload Convention

Upload endpoints must:

- Validate file size.
- Validate MIME type and actual file content.
- Generate safe server-side filenames.
- Prevent path traversal.
- Restrict upload permissions.
- Avoid trusting the original filename.
- Store file metadata and ownership.
- Use secure storage for production.

Suggested allowed formats:

- JPEG
- PNG
- WebP
- PDF

## 20. API Versioning

All APIs must use versioned routes.

Current version:

```text
/api/v1
```

Breaking changes should be introduced through a new API version rather than silently changing existing contracts.

## 21. Security Standards

- Helmet security headers.
- CORS allowlist.
- Rate limiting.
- Zod request validation.
- JWT authentication.
- Role and permission checks.
- Password hashing with bcrypt.
- Secure environment variables.
- Safe MongoDB query construction.
- Audit logging for sensitive operations.

## 22. Idempotency

For payment and other retry-sensitive operations, use an idempotency key.

Example:

```http
POST /api/v1/fees/payments
Idempotency-Key: unique-request-key
```

The server must prevent duplicate financial transactions when the same key is retried.

## 23. API Documentation

Maintain API documentation for every module.

Each endpoint should document:

- HTTP method.
- URL.
- Authentication requirement.
- Required permission.
- Path parameters.
- Query parameters.
- Request body.
- Success response.
- Error responses.
- Tenant scope.

## 24. Development Rules

Every module must follow:

```text
module-name/
├── module.controller.ts
├── module.model.ts
├── module.routes.ts
├── module.service.ts
└── module.validation.ts
```

Responsibilities:

- Controller: HTTP request and response.
- Service: Business logic.
- Model: MongoDB schema.
- Routes: Endpoint registration.
- Validation: Input validation.

Controllers must not contain complex business logic.

Services must not depend on Express request or response objects.

## 25. Final Rule

All MirexERP APIs must follow the same:

- Naming conventions.
- Authentication standards.
- Authorization rules.
- Tenant isolation rules.
- Validation standards.
- Response formats.
- Error handling.
- Pagination standards.
- Security practices.

Any exception must be documented and reviewed before implementation.
