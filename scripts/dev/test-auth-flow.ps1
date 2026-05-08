param(
  [string]$BaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" })
)

$ErrorActionPreference = "Stop"
$unique = Get-Date -Format "yyyyMMddHHmmss"
$email = "owner-$unique@example.com"

Write-Host "Checking plans endpoint..."
$plans = Invoke-RestMethod -Uri "$BaseUrl/api/v1/public/plans" -Method Get
$plans | ConvertTo-Json -Depth 6

Write-Host "`nRegistering tenant with email: $email"
$registerBody = @{
  barbershop_name = "Barbera Demo $unique"
  full_name = "Owner Demo"
  email = $email
  phone_number = "081234567890"
  password = "password123"
} | ConvertTo-Json

$registerResult = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body $registerBody

$registerResult | ConvertTo-Json -Depth 6

Write-Host "`nLogging in..."
$loginBody = @{
  email = $email
  password = "password123"
} | ConvertTo-Json

$loginResult = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody

$loginResult | ConvertTo-Json -Depth 6

Write-Host "`nFetching profile..."
$meResult = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/auth/me" `
  -Method Get `
  -Headers @{ Authorization = "Bearer $($loginResult.access_token)" }

$meResult | ConvertTo-Json -Depth 6

Write-Host "`nAuth flow test completed."
