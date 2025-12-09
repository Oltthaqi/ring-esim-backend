# 🧪 Complete Flow Testing Guide: eSIM Order → Top-up → Usage Tracking

## 🎯 **Testing Overview**

This guide walks you through testing the complete customer journey:

1. **Authentication** → Get JWT token
2. **Order eSIM** → Create initial subscription
3. **Process Order** → Activate with OCS
4. **Create Usage Tracking** → Link order to usage monitoring
5. **Top-up** → Add more data to existing subscriber
6. **Process Top-up** → Activate additional package
7. **Usage Monitoring** → View consolidated and individual usage

---

## 🚀 **Step 1: Authentication**

### **Get JWT Token**

```bash
# Method 1: Using curl
curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Method 2: Using PowerShell
$loginData = @{
    email = "your-email@example.com"
    password = "your-password"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
$tokenData = $response.Content | ConvertFrom-Json
$token = $tokenData.access_token
Write-Output "Token: $token"

# Set headers for subsequent requests
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
```

**Expected Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uuid": "user-id-here",
    "email": "your-email@example.com"
  }
}
```

---

## 📱 **Step 2: Order eSIM (Initial Package)**

### **Create Order**

```bash
# PowerShell
$orderData = @{
    packageTemplateId = "0278953d-abb5-4135-8068-01c2e8a066df"  # Your package template ID
    amount = 49.99
    currency = "USD"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/orders" -Method POST -Body $orderData -Headers $headers
$orderResponse = $response.Content | ConvertFrom-Json
$orderId = $orderResponse.id
Write-Output "Order ID: $orderId"
```

**Expected Response:**

```json
{
  "id": "new-order-id-uuid",
  "orderNumber": "ORD-1757123456789-123",
  "packageTemplateId": "0278953d-abb5-4135-8068-01c2e8a066df",
  "orderType": "one_time",
  "status": "pending",
  "amount": "49.99",
  "currency": "USD"
}
```

---

## ⚡ **Step 3: Process Order (Activate with OCS)**

### **Process the Order**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/$orderId/process" -Method POST -Headers $headers
$processedOrder = $response.Content | ConvertFrom-Json
$subscriberId = $processedOrder.subscriberId
Write-Output "Subscriber ID: $subscriberId"
Write-Output "ICCID: $($processedOrder.iccid)"
Write-Output "Activation Code: $($processedOrder.activationCode)"
```

**Expected Response:**

```json
{
  "id": "order-id",
  "status": "completed",
  "subscriberId": "28345720",
  "iccid": "8948010000054019584",
  "activationCode": "K2-ABC123-DEF456",
  "smdpServer": "smdp.io",
  "urlQrCode": "LPA:1$smdp.io$K2-ABC123-DEF456"
}
```

---

## 📊 **Step 4: Create Usage Tracking**

### **Initialize Usage Monitoring**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/order/$orderId/create" -Method POST -Headers $headers
$usageRecord = $response.Content | ConvertFrom-Json
$usageId = $usageRecord.id
Write-Output "Usage Record ID: $usageId"
```

**Expected Response:**

```json
{
  "id": "usage-record-id",
  "orderId": "order-id",
  "subscriberId": 28345720,
  "iccid": "8948010000054019584",
  "totalDataUsed": 0,
  "totalDataAllowed": 10737418240, // 10GB in bytes
  "totalDataRemaining": 10737418240,
  "usagePercentage": 0,
  "status": "active",
  "lastSyncedAt": "2025-01-15T19:00:00Z"
}
```

---

## 📈 **Step 5: Check Initial Usage**

### **View My Orders (with Usage)**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/my-orders" -Headers $headers
$myOrders = $response.Content | ConvertFrom-Json
Write-Output "Orders with Usage:"
$myOrders | ConvertTo-Json -Depth 5
```

### **View Consolidated Usage**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/consolidated" -Headers $headers
$consolidated = $response.Content | ConvertFrom-Json
Write-Output "Consolidated Usage:"
$consolidated | ConvertTo-Json -Depth 5
```

---

## 🔄 **Step 6: Create Top-up Order**

### **Add More Data to Existing Subscriber**

```bash
# PowerShell - Use the subscriberId from Step 3
$topupData = @{
    packageTemplateId = "another-package-template-id"  # Different package for top-up
    subscriberId = [int]$subscriberId  # Convert to number
    amount = 25.99
    currency = "USD"
    reportUnitsPreviousPackage = $true  # Carry over remaining data
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/topup" -Method POST -Body $topupData -Headers $headers
$topupOrder = $response.Content | ConvertFrom-Json
$topupOrderId = $topupOrder.id
Write-Output "Top-up Order ID: $topupOrderId"
```

**Expected Response:**

```json
{
  "id": "topup-order-id",
  "orderNumber": "ORD-1757123456790-124",
  "orderType": "topup",
  "status": "pending",
  "subscriberId": "28345720",
  "amount": "25.99"
}
```

---

## ⚡ **Step 7: Process Top-up**

### **Activate Top-up with OCS**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/$topupOrderId/topup-process" -Method POST -Headers $headers
$processedTopup = $response.Content | ConvertFrom-Json
Write-Output "Top-up processed successfully"
```

---

## 📊 **Step 8: Create Usage Tracking for Top-up**

### **Link Top-up to Usage Monitoring**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/order/$topupOrderId/create" -Method POST -Headers $headers
$topupUsage = $response.Content | ConvertFrom-Json
Write-Output "Top-up Usage Record ID: $($topupUsage.id)"
```

---

## 🎯 **Step 9: View Complete Usage Picture**

### **A. Individual Orders (Shows Per-Order Usage)**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/orders/my-orders" -Headers $headers
$orders = $response.Content | ConvertFrom-Json

Write-Output "`n=== INDIVIDUAL ORDER USAGE ==="
foreach ($order in $orders) {
    Write-Output "`nOrder: $($order.orderNumber) ($($order.orderType))"
    Write-Output "Package: $($order.packageTemplate.packageTemplateName)"
    Write-Output "Volume: $($order.packageTemplate.volume)"
    if ($order.usage) {
        $usedMB = [math]::Round($order.usage.totalDataUsed / 1024 / 1024, 2)
        $allowedMB = [math]::Round($order.usage.totalDataAllowed / 1024 / 1024, 2)
        Write-Output "Usage: ${usedMB}MB / ${allowedMB}MB ($($order.usage.usagePercentage)%)"
        Write-Output "Status: $($order.usage.status)"
    }
}
```

### **B. Consolidated Usage (Recommended for Customers)**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/consolidated" -Headers $headers
$consolidated = $response.Content | ConvertFrom-Json

Write-Output "`n=== CONSOLIDATED USAGE BY SUBSCRIBER ==="
foreach ($subscriber in $consolidated.data) {
    Write-Output "`nSubscriber ID: $($subscriber.subscriberId)"
    Write-Output "ICCID: $($subscriber.iccid)"

    $usedGB = [math]::Round($subscriber.totalDataUsed / 1024 / 1024 / 1024, 2)
    $allowedGB = [math]::Round($subscriber.totalDataAllowed / 1024 / 1024 / 1024, 2)
    $remainingGB = [math]::Round($subscriber.totalDataRemaining / 1024 / 1024 / 1024, 2)

    Write-Output "Total Usage: ${usedGB}GB / ${allowedGB}GB (${remainingGB}GB remaining)"
    Write-Output "Usage Percentage: $($subscriber.usagePercentage)%"
    Write-Output "Status: $($subscriber.status)"
    Write-Output "Total Packages: $($subscriber.totalPackages)"

    Write-Output "`nPackage Breakdown:"
    foreach ($package in $subscriber.packages) {
        $pkgGB = [math]::Round($package.allowanceBytes / 1024 / 1024 / 1024, 2)
        Write-Output "  - $($package.packageName) (${pkgGB}GB) - $($package.orderType)"
    }
}
```

---

## 🔄 **Step 10: Simulate Usage and Sync**

### **Manually Sync Usage with OCS**

```bash
# PowerShell - Sync both usage records
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/$usageId/sync" -Method POST -Headers $headers
Write-Output "Original usage synced"

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/$($topupUsage.id)/sync" -Method POST -Headers $headers
Write-Output "Top-up usage synced"

# Or sync all at once (Admin only)
# $response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/sync-all" -Method POST -Headers $headers
```

### **Check Updated Usage**

```bash
# PowerShell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/usage/consolidated" -Headers $headers
$updated = $response.Content | ConvertFrom-Json

Write-Output "`n=== UPDATED USAGE AFTER SYNC ==="
foreach ($subscriber in $updated.data) {
    $usedGB = [math]::Round($subscriber.totalDataUsed / 1024 / 1024 / 1024, 2)
    $allowedGB = [math]::Round($subscriber.totalDataAllowed / 1024 / 1024 / 1024, 2)
    Write-Output "Updated Usage: ${usedGB}GB / ${allowedGB}GB ($($subscriber.usagePercentage)%)"
    Write-Output "Last Synced: $($subscriber.lastSyncedAt)"
}
```

---

## 📝 **Complete PowerShell Test Script**

Save this as `test-complete-flow.ps1`:

```powershell
# Complete eSIM Flow Test Script
$baseUrl = "http://localhost:3000/api"

Write-Output "🧪 Starting Complete eSIM Flow Test..."

# Step 1: Login
Write-Output "`n1️⃣ Authentication..."
$loginData = @{
    email = "your-email@example.com"  # Replace with your credentials
    password = "your-password"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    $tokenData = $response.Content | ConvertFrom-Json
    $token = $tokenData.access_token
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }
    Write-Output "✅ Authenticated successfully"
} catch {
    Write-Output "❌ Authentication failed: $($_.Exception.Message)"
    exit 1
}

# Step 2: Create Order
Write-Output "`n2️⃣ Creating eSIM Order..."
$orderData = @{
    packageTemplateId = "0278953d-abb5-4135-8068-01c2e8a066df"  # Replace with your package ID
    amount = 49.99
    currency = "USD"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -Body $orderData -Headers $headers
    $order = $response.Content | ConvertFrom-Json
    $orderId = $order.id
    Write-Output "✅ Order created: $($order.orderNumber)"
} catch {
    Write-Output "❌ Order creation failed: $($_.Exception.Message)"
    exit 1
}

# Step 3: Process Order
Write-Output "`n3️⃣ Processing Order with OCS..."
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/orders/$orderId/process" -Method POST -Headers $headers
    $processedOrder = $response.Content | ConvertFrom-Json
    $subscriberId = $processedOrder.subscriberId
    Write-Output "✅ Order processed. Subscriber ID: $subscriberId"
    Write-Output "   ICCID: $($processedOrder.iccid)"
    Write-Output "   Activation Code: $($processedOrder.activationCode)"
} catch {
    Write-Output "❌ Order processing failed: $($_.Exception.Message)"
    exit 1
}

# Step 4: Create Usage Tracking
Write-Output "`n4️⃣ Creating Usage Tracking..."
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/usage/order/$orderId/create" -Method POST -Headers $headers
    $usage = $response.Content | ConvertFrom-Json
    $usageId = $usage.id
    Write-Output "✅ Usage tracking created: $usageId"
} catch {
    Write-Output "❌ Usage tracking creation failed: $($_.Exception.Message)"
}

# Step 5: Create Top-up
Write-Output "`n5️⃣ Creating Top-up Order..."
$topupData = @{
    packageTemplateId = "0278953d-abb5-4135-8068-01c2e8a066df"  # Same or different package
    subscriberId = [int]$subscriberId
    amount = 25.99
    currency = "USD"
    reportUnitsPreviousPackage = $true
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/orders/topup" -Method POST -Body $topupData -Headers $headers
    $topupOrder = $response.Content | ConvertFrom-Json
    $topupOrderId = $topupOrder.id
    Write-Output "✅ Top-up order created: $($topupOrder.orderNumber)"
} catch {
    Write-Output "❌ Top-up creation failed: $($_.Exception.Message)"
    exit 1
}

# Step 6: Process Top-up
Write-Output "`n6️⃣ Processing Top-up..."
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/orders/$topupOrderId/topup-process" -Method POST -Headers $headers
    Write-Output "✅ Top-up processed successfully"
} catch {
    Write-Output "❌ Top-up processing failed: $($_.Exception.Message)"
}

# Step 7: Create Usage Tracking for Top-up
Write-Output "`n7️⃣ Creating Usage Tracking for Top-up..."
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/usage/order/$topupOrderId/create" -Method POST -Headers $headers
    $topupUsage = $response.Content | ConvertFrom-Json
    Write-Output "✅ Top-up usage tracking created: $($topupUsage.id)"
} catch {
    Write-Output "❌ Top-up usage tracking failed: $($_.Exception.Message)"
}

# Step 8: View Results
Write-Output "`n8️⃣ Viewing Complete Usage Picture..."

# Individual Orders
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/orders/my-orders" -Headers $headers
    $orders = $response.Content | ConvertFrom-Json

    Write-Output "`n📱 INDIVIDUAL ORDERS:"
    foreach ($order in $orders) {
        Write-Output "   Order: $($order.orderNumber) ($($order.orderType))"
        if ($order.usage) {
            $usedMB = [math]::Round($order.usage.totalDataUsed / 1024 / 1024, 2)
            $allowedMB = [math]::Round($order.usage.totalDataAllowed / 1024 / 1024, 2)
            Write-Output "   Usage: ${usedMB}MB / ${allowedMB}MB ($([math]::Round($order.usage.usagePercentage, 2))%)"
        }
    }
} catch {
    Write-Output "❌ Failed to get individual orders: $($_.Exception.Message)"
}

# Consolidated Usage
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/usage/consolidated" -Headers $headers
    $consolidated = $response.Content | ConvertFrom-Json

    Write-Output "`n🔗 CONSOLIDATED USAGE:"
    foreach ($subscriber in $consolidated.data) {
        $usedGB = [math]::Round($subscriber.totalDataUsed / 1024 / 1024 / 1024, 2)
        $allowedGB = [math]::Round($subscriber.totalDataAllowed / 1024 / 1024 / 1024, 2)
        Write-Output "   Subscriber: $($subscriber.subscriberId)"
        Write-Output "   Total: ${usedGB}GB / ${allowedGB}GB ($([math]::Round($subscriber.usagePercentage, 2))%)"
        Write-Output "   Packages: $($subscriber.totalPackages)"
        Write-Output "   Status: $($subscriber.status)"
    }
} catch {
    Write-Output "❌ Failed to get consolidated usage: $($_.Exception.Message)"
}

Write-Output "`n🎉 Complete flow test finished!"
Write-Output "`n📊 Key Endpoints to monitor:"
Write-Output "   - Individual Orders: GET $baseUrl/orders/my-orders"
Write-Output "   - Consolidated Usage: GET $baseUrl/usage/consolidated"
Write-Output "   - Usage Summary: GET $baseUrl/usage/summary"
```

---

## 🎯 **What to Expect**

### **After Original Order:**

- ✅ 1 order with status "completed"
- ✅ 1 usage record with full allowance
- ✅ 0% usage initially

### **After Top-up:**

- ✅ 2 orders (original + top-up)
- ✅ 2 usage records (both linked to same subscriber)
- ✅ Consolidated view shows combined allowance
- ✅ Individual views show same total usage across both records

### **Key Insights:**

- 🔍 **Individual orders** show usage as % of THAT package only
- 🎯 **Consolidated view** shows usage as % of ALL packages combined
- ⚡ **OCS returns same total usage** for all records of same subscriber
- 📊 **Customer-facing usage** should use consolidated endpoint

This complete testing flow will validate that your eSIM ordering, top-up, and usage tracking system works end-to-end! 🚀
