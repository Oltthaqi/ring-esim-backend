# Get JWT Token for Testing

## Method 1: Using Login API

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

## Method 2: Using Swagger UI

1. Open http://localhost:3000/api/docs
2. Use the `/auth/login` endpoint
3. Copy the token from the response

## Method 3: PowerShell Example

```powershell
$loginData = @{
    email = "your-email@example.com"
    password = "your-password"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -Body $loginData -ContentType "application/json"
$tokenData = $response.Content | ConvertFrom-Json
$token = $tokenData.access_token
Write-Output "Your token: $token"
```

## Method 4: Use the HTML Test Page

1. Open `test-api.html` in your browser
2. Get your token from login
3. Set it in the authentication section
4. Test the APIs directly
adni