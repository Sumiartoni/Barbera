param(
  [string]$BaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" })
)

$ErrorActionPreference = "Stop"

$unique = Get-Date -Format "yyyyMMddHHmmss"
$email = "ops-$unique@example.com"
$today = Get-Date
$tomorrow = $today.AddDays(1)

Write-Host "Registering tenant..."
$registerBody = @{
  barbershop_name = "Barbera Ops $unique"
  full_name = "Owner Ops"
  email = $email
  phone_number = "0812$($unique.Substring($unique.Length - 8))"
  password = "password123"
} | ConvertTo-Json

$register = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body $registerBody

$token = $register.access_token
$headers = @{ Authorization = "Bearer $token" }

Write-Host "`nCreating barbers..."
$raka = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/barbers" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    full_name = "Raka"
    phone_number = "081211110001"
    sort_order = 1
  } | ConvertTo-Json)

$bimo = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/barbers" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    full_name = "Bimo"
    phone_number = "081211110002"
    sort_order = 2
  } | ConvertTo-Json)

$barbers = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/barbers" `
  -Method Get `
  -Headers $headers

$barbers | ConvertTo-Json -Depth 8

Write-Host "`nCreating stations..."
$stationOne = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/stations" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{ name = "Kursi 1" } | ConvertTo-Json)

$stationTwo = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/stations" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{ name = "Kursi 2" } | ConvertTo-Json)

$stations = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/stations" `
  -Method Get `
  -Headers $headers

$stations | ConvertTo-Json -Depth 8

Write-Host "`nCreating active shift for Raka via API..."
$shiftStart = $today.AddHours(-1).ToString("o")
$shiftEnd = $today.AddHours(6).ToString("o")
$shift = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/shifts" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    barber_id = $raka.id
    starts_at = $shiftStart
    ends_at = $shiftEnd
    notes = "Shift utama"
  } | ConvertTo-Json)

$shift | ConvertTo-Json -Depth 8

$shiftList = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/shifts?day=$($today.ToString('yyyy-MM-dd'))" `
  -Method Get `
  -Headers $headers

$shiftList | ConvertTo-Json -Depth 8

Write-Host "`nCreating customer with preferred barber..."
$customer = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/customers" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    full_name = "Pelanggan Ops"
    phone_number = "0813$($unique.Substring($unique.Length - 8))"
    preferred_barber_id = $raka.id
    notes = "Suka potongan fade"
  } | ConvertTo-Json)

$customer | ConvertTo-Json -Depth 8

Write-Host "`nCreating queue ticket..."
$ticket = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/queue" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    customer_id = $customer.id
    preferred_barber_id = $raka.id
    source = "walk_in"
    notes = "Minta barber favorit"
  } | ConvertTo-Json)

$ticket | ConvertTo-Json -Depth 8

$queue = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/queue" `
  -Method Get `
  -Headers $headers

$queue | ConvertTo-Json -Depth 8

Write-Host "`nCreating visit with barber and station..."
$visit = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/visits" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    customer_id = $customer.id
    service_name = "Haircut Premium"
    barber_id = $raka.id
    station_id = $stationOne.id
    amount_idr = 65000
    payment_status = "paid"
    reminder_days = 21
    notes = "Barber favorit berhasil dilayani"
  } | ConvertTo-Json)

$visit | ConvertTo-Json -Depth 8

Write-Host "`nTesting owner shift command via WhatsApp-style syntax..."
$commandAdd = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/owner-tools/shift-command" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    command = "SHIFT ADD|Bimo|$($tomorrow.ToString('yyyy-MM-dd'))|10:00|18:00"
  } | ConvertTo-Json)

$commandAdd | ConvertTo-Json -Depth 8

$commandList = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/owner-tools/shift-command" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    command = "SHIFT LIST $($tomorrow.ToString('yyyy-MM-dd'))"
  } | ConvertTo-Json)

$commandList | ConvertTo-Json -Depth 8

$commandOff = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/owner-tools/shift-command" `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body (@{
    command = "SHIFT OFF|Bimo|$($tomorrow.ToString('yyyy-MM-dd'))"
  } | ConvertTo-Json)

$commandOff | ConvertTo-Json -Depth 8

Write-Host "`nLoading dashboard summary..."
$summary = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/dashboard/summary" `
  -Method Get `
  -Headers $headers

$summary | ConvertTo-Json -Depth 10

Write-Host "`nOperations flow test completed."
