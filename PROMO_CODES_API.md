# Promo Codes API Documentation

## Overview

This module implements a percentage-based promo code system for orders. Admins can create and manage promo codes, and users can apply a single optional promo code to their orders.

---

## Database Schema

### `promo_codes` Table

| Column      | Type                   | Description                                     |
| ----------- | ---------------------- | ----------------------------------------------- |
| id          | uuid                   | Primary key                                     |
| code        | varchar(50)            | Promo code (case-insensitive, stored uppercase) |
| name        | varchar(255)           | Admin-friendly name                             |
| percent_off | numeric(5,2)           | Percentage discount (0.01-100.00)               |
| status      | enum(ACTIVE, INACTIVE) | Code status                                     |
| start_at    | timestamptz            | Start date (nullable)                           |
| end_at      | timestamptz            | End date (nullable)                             |
| created_by  | uuid                   | FK to users (nullable)                          |
| created_at  | timestamptz            | Creation timestamp                              |
| updated_at  | timestamptz            | Last update timestamp                           |

**Indexes:**

- Unique index on `UPPER(code)` for case-insensitive uniqueness
- Composite index on `(status, start_at, end_at)` for validation queries

### `orders` Table (New Fields)

| Column           | Type          | Description                       |
| ---------------- | ------------- | --------------------------------- |
| subtotal_amount  | numeric(12,2) | Before discounts                  |
| promo_code_id    | uuid          | FK to promo_codes (nullable)      |
| promo_code_code  | varchar(50)   | Snapshot of code                  |
| discount_percent | numeric(5,2)  | Snapshot of percent               |
| discount_amount  | numeric(12,2) | Computed discount                 |
| total_amount     | numeric(12,2) | Final total (subtotal - discount) |

---

## Business Rules

1. **Single Code Per Order**: Only one promo code can be applied per order
2. **Code Validation**:
   - Must be ACTIVE status
   - Must be within validity window (start_at/end_at)
   - Order must be open/unpaid
3. **Discount Calculation**:
   ```
   discount_amount = round(subtotal_amount × (discount_percent / 100), 2)
   total_amount = max(0, subtotal_amount - discount_amount)
   ```
4. **Idempotency**: Re-applying the same code is a no-op
5. **Replacement**: Applying a different code replaces the previous one
6. **Snapshots**: Code details are stored in the order for historical accuracy

---

## API Endpoints

### Admin Endpoints

All admin endpoints require **Bearer token** with **ADMIN role**.

#### Create Promo Code

```http
POST /api/admin/promo-codes
Content-Type: application/json
Authorization: Bearer <token>

{
  "code": "SUMMER25",
  "name": "Summer 2025 Promotion",
  "percent_off": 25.5,
  "status": "ACTIVE",
  "start_at": "2025-06-01T00:00:00Z",
  "end_at": "2025-08-31T23:59:59Z"
}
```

**Response (201 Created):**

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "code": "SUMMER25",
  "name": "Summer 2025 Promotion",
  "percent_off": 25.5,
  "status": "ACTIVE",
  "start_at": "2025-06-01T00:00:00.000Z",
  "end_at": "2025-08-31T23:59:59.000Z",
  "created_at": "2025-10-01T14:00:00.000Z",
  "updated_at": "2025-10-01T14:00:00.000Z"
}
```

**Errors:**

- `400 Bad Request`: Duplicate code, invalid dates, or validation error

---

#### Update Promo Code

```http
PATCH /api/admin/promo-codes/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Winter 2025 Promotion",
  "percent_off": 30.0,
  "status": "INACTIVE"
}
```

**Response (200 OK):** Updated promo code object

**Errors:**

- `404 Not Found`: Promo code ID doesn't exist
- `400 Bad Request`: Invalid dates

---

#### List Promo Codes

```http
GET /api/admin/promo-codes?status=ACTIVE&search=summer&page=1&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**

- `status` (optional): Filter by ACTIVE or INACTIVE
- `search` (optional): Search by code or name
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "code": "SUMMER25",
      "name": "Summer 2025 Promotion",
      "percent_off": 25.5,
      "status": "ACTIVE",
      "start_at": "2025-06-01T00:00:00.000Z",
      "end_at": "2025-08-31T23:59:59.000Z",
      "created_at": "2025-10-01T14:00:00.000Z",
      "updated_at": "2025-10-01T14:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

---

#### Get Promo Code

```http
GET /api/admin/promo-codes/:id
Authorization: Bearer <token>
```

**Response (200 OK):** Promo code object

**Errors:**

- `404 Not Found`: Promo code ID doesn't exist

---

### Public Endpoints (User)

All public endpoints require **Bearer token** and **order ownership**.

#### Validate Promo Code

```http
POST /api/promo-codes/validate
Content-Type: application/json
Authorization: Bearer <token>

{
  "code": "SUMMER25",
  "orderId": "456e4567-e89b-12d3-a456-426614174000"
}
```

**Response (200 OK - Valid):**

```json
{
  "valid": true,
  "code": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "code": "SUMMER25",
    "name": "Summer 2025 Promotion",
    "percent_off": 25.5
  }
}
```

**Response (200 OK - Invalid):**

```json
{
  "valid": false,
  "reason": "CODE_EXPIRED"
}
```

**Reason Codes:**

- `CODE_NOT_FOUND`: Code doesn't exist
- `CODE_INACTIVE`: Code is not active
- `CODE_NOT_YET_VALID`: Current date before start_at
- `CODE_EXPIRED`: Current date after end_at
- `ORDER_LOCKED`: Order is completed/processing

**Errors:**

- `403 Forbidden`: Not order owner
- `404 Not Found`: Order doesn't exist

---

#### Apply Promo Code

```http
POST /api/orders/:orderId/apply-promo-code
Content-Type: application/json
Authorization: Bearer <token>

{
  "code": "SUMMER25"
}
```

**Response (200 OK):**

```json
{
  "orderId": "456e4567-e89b-12d3-a456-426614174000",
  "currency": "EUR",
  "subtotal_amount": 100.0,
  "promo": {
    "code": "SUMMER25",
    "name": "Summer 2025 Promotion",
    "percent": 25.5
  },
  "discount_amount": 25.5,
  "total_amount": 74.5
}
```

**Behavior:**

- If same code already applied → idempotent (returns current pricing)
- If different code applied → replaces previous code
- Computes and stores discount snapshot

**Errors:**

- `400 Bad Request`: Invalid promo code, order locked, or validation error
- `403 Forbidden`: Not order owner
- `404 Not Found`: Order doesn't exist

---

#### Remove Promo Code

```http
POST /api/orders/:orderId/remove-promo-code
Content-Type: application/json
Authorization: Bearer <token>

{}
```

**Response (200 OK):**

```json
{
  "orderId": "456e4567-e89b-12d3-a456-426614174000",
  "currency": "EUR",
  "subtotal_amount": 100.0,
  "promo": null,
  "discount_amount": 0.0,
  "total_amount": 100.0
}
```

**Errors:**

- `400 Bad Request`: Order locked
- `403 Forbidden`: Not order owner
- `404 Not Found`: Order doesn't exist

---

#### Get Order Pricing

```http
GET /api/orders/:orderId/pricing
Authorization: Bearer <token>
```

**Response (200 OK):** Same as apply/remove response

**Errors:**

- `403 Forbidden`: Not order owner
- `404 Not Found`: Order doesn't exist

---

## Error Format

All errors follow this structure:

```json
{
  "statusCode": 400,
  "message": "Invalid promo code: CODE_EXPIRED",
  "error": "Bad Request"
}
```

---

## Audit Logging

All promo code operations are logged with the following details:

### Create/Update

```
Promo code created: SUMMER25 (25.5% off) by user 123e4567-e89b-12d3-a456-426614174000
Promo code updated: SUMMER25 (ID: 123e4567-e89b-12d3-a456-426614174000)
```

### Apply

```
Applying promo code 'SUMMER25' to order 456e4567-e89b-12d3-a456-426614174000 by user 789e4567-e89b-12d3-a456-426614174000. Old total: 100.00, Old discount: 0
Promo code applied: SUMMER25 to order 456e4567-e89b-12d3-a456-426614174000. New total: 74.50, Discount: 25.50
```

### Remove

```
Removing promo code from order 456e4567-e89b-12d3-a456-426614174000 by user 789e4567-e89b-12d3-a456-426614174000. Old code: SUMMER25, Old discount: 25.50
Promo code removed from order 456e4567-e89b-12d3-a456-426614174000
```

### Idempotent Apply

```
Promo code 'SUMMER25' already applied to order 456e4567-e89b-12d3-a456-426614174000 - idempotent
```

---

## Testing

### Example Flow

1. **Admin creates promo code**:

   ```bash
   curl -X POST http://localhost:3000/api/admin/promo-codes \
     -H "Authorization: Bearer <admin-token>" \
     -H "Content-Type: application/json" \
     -d '{"code":"TEST10","name":"Test 10% Off","percent_off":10.0}'
   ```

2. **User validates code**:

   ```bash
   curl -X POST http://localhost:3000/api/promo-codes/validate \
     -H "Authorization: Bearer <user-token>" \
     -H "Content-Type: application/json" \
     -d '{"code":"TEST10","orderId":"<order-id>"}'
   ```

3. **User applies code**:

   ```bash
   curl -X POST http://localhost:3000/api/orders/<order-id>/apply-promo-code \
     -H "Authorization: Bearer <user-token>" \
     -H "Content-Type: application/json" \
     -d '{"code":"TEST10"}'
   ```

4. **User gets pricing**:

   ```bash
   curl -X GET http://localhost:3000/api/orders/<order-id>/pricing \
     -H "Authorization: Bearer <user-token>"
   ```

5. **User removes code (optional)**:
   ```bash
   curl -X POST http://localhost:3000/api/orders/<order-id>/remove-promo-code \
     -H "Authorization: Bearer <user-token>" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

---

## Notes

- **Rounding**: Banker's rounding is used for discount calculations (round to 2 decimals)
- **Currency**: All amounts are in the order's currency
- **Case-Insensitivity**: Promo codes are stored and compared in uppercase
- **Snapshots**: Historical orders preserve applied promo code details even if the code is later modified or deleted
- **No Cashback**: Negative totals are prevented; `total_amount = max(0, subtotal - discount)`
