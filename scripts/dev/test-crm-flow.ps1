param(
  [string]$BaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" })
)

$ErrorActionPreference = "Stop"

$unique = Get-Date -Format "yyyyMMddHHmmss"
$email = "crm-$unique@example.com"

Write-Host "Registering tenant..."
$registerBody = @{
  barbershop_name = "Barbera CRM $unique"
  full_name = "Owner CRM"
  email = $email
  phone_number = "081234567890"
  password = "password123"
} | ConvertTo-Json

$register = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body $registerBody

$token = $register.access_token

Write-Host "`nCreating customer..."
$customerBody = @{
  full_name = "Pelanggan Demo"
  phone_number = "0813$unique"
  preferred_barber = "Raka"
  notes = "Suka potongan rapi"
} | ConvertTo-Json

$customer = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/customers" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $customerBody

$customer | ConvertTo-Json -Depth 8

Write-Host "`nCreating visit..."
$visitBody = @{
  customer_id = $customer.id
  service_name = "Haircut Premium"
  barber_name = "Raka"
  amount_idr = 55000
  payment_status = "paid"
  reminder_days = 21
  notes = "Trim and wash"
} | ConvertTo-Json

$visit = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/visits" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Body $visitBody

$visit | ConvertTo-Json -Depth 8

Write-Host "`nLoading dashboard summary..."
$summary = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/dashboard/summary" `
  -Method Get `
  -Headers @{ Authorization = "Bearer $token" }

$summary | ConvertTo-Json -Depth 10

Write-Host "`nCRM flow test completed."
