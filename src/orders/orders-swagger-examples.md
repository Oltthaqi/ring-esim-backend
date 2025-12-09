# Orders API - Swagger Documentation Examples

## 🎯 API Endpoints Now Available in Swagger

### **1. POST /orders - Create eSIM Order**

```json
{
  "packageTemplateId": "123e4567-e89b-12d3-a456-426614174000",
  "orderType": "one_time",
  "amount": 25.99,
  "currency": "USD",
  "subscriberId": 1000,
  "validityPeriod": 30
}
```

### **2. GET /orders - Get All Orders**

Query Parameters:

- `all` (optional): "true" - Admin only, gets all users' orders

### **3. GET /orders/{id} - Get Order Details**

Returns complete order information including activation details.

### **4. PATCH /orders/{id} - Update Order (Admin)**

```json
{
  "status": "completed"
}
```

### **5. POST /orders/{id}/cancel - Cancel Order**

Cancels pending orders (cannot cancel completed orders).

### **6. POST /orders/{id}/process - Process Order (Admin)**

Manually triggers order processing.

## 🔐 Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## 📋 Order Types

- `one_time`: Single package purchase
- `recurring`: Recurring subscription

## 📊 Order Status

- `pending`: Order created, awaiting processing
- `processing`: Being processed with provider
- `completed`: Successfully completed
- `failed`: Processing failed
- `cancelled`: Order cancelled

## 🎛️ Subscriber Identification Options

You can identify the subscriber using any of these (only one required):

- `subscriberId`: Existing subscriber ID
- `imsi`: IMSI number
- `iccid`: ICCID number
- `msisdn`: Phone number
- `activationCode`: Existing activation code

## 📱 Response Includes eSIM Activation Details

When order completes successfully, you get:

- `activationCode`: For manual entry
- `urlQrCode`: QR code string for scanning
- `smdpServer`: SM-DP+ server address
- `iccid`: eSIM ICCID
- `userSimName`: Friendly name for the eSIM
