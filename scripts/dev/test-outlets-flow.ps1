param(
  [string]$BaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" }),
  [string]$PlatformAdminKey = $(if ($env:PLATFORM_ADMIN_API_KEY) { $env:PLATFORM_ADMIN_API_KEY } else { "dev-platform-admin-key-change-me" })
)

$ErrorActionPreference = "Stop"

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

$unique = Get-Date -Format "yyyyMMddHHmmss"
$email = "outlets-$unique@example.com"

Write-Host "Registering tenant for outlet flow..."
$register = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/auth/register" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{
    barbershop_name = "Barbera Outlet $unique"
    full_name = "Owner Outlet"
    email = $email
    phone_number = "0819$($unique.Substring($unique.Length - 8))"
    password = "Password123!"
  } | ConvertTo-Json)

$headers = @{ Authorization = "Bearer $($register.access_token)" }

Write-Host "Loading default outlet entitlement..."
$outlets = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/outlets" `
  -Method Get `
  -Headers $headers

Assert-True ($outlets.outlets.Count -eq 1) "Tenant baru harus memiliki 1 outlet utama."
Assert-True ($outlets.entitlement.plan_code -eq "free") "Tenant baru harus masuk plan free."
Assert-True (-not $outlets.entitlement.can_create_more) "Free plan tidak boleh menambah outlet kedua."

Write-Host "Ensuring free plan cannot create second outlet..."
$freeRejected = $false
try {
  Invoke-RestMethod `
    -Uri "$BaseUrl/api/v1/outlets" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body (@{
      name = "Cabang Kedua"
      code = "CBG-2"
      address = "Jl. Uji 2"
      phone_number = "0210000002"
    } | ConvertTo-Json) | Out-Null
} catch {
  $freeRejected = $_.Exception.Message -like "*403*"
}

Assert-True $freeRejected "Free plan harus ditolak saat menambah outlet kedua."

Write-Host "Upgrading tenant to Pro via platform API..."
Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/platform/tenants/$($register.tenant.id)/plan" `
  -Method Post `
  -Headers @{ "X-Platform-Admin-Key" = $PlatformAdminKey } `
  -ContentType "application/json" `
  -Body (@{ plan_code = "pro" } | ConvertTo-Json) | Out-Null

Write-Host "Creating second and third outlet on Pro..."
Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/outlets" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    name = "Cabang Selatan"
    code = "SEL"
    address = "Jl. Selatan"
    phone_number = "0210000003"
  } | ConvertTo-Json) | Out-Null

Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/outlets" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    name = "Cabang Utara"
    code = "UTR"
    address = "Jl. Utara"
    phone_number = "0210000004"
  } | ConvertTo-Json) | Out-Null

$afterUpgrade = Invoke-RestMethod `
  -Uri "$BaseUrl/api/v1/outlets" `
  -Method Get `
  -Headers $headers

Assert-True ($afterUpgrade.entitlement.plan_code -eq "pro") "Plan tenant harus berubah ke Pro."
Assert-True ($afterUpgrade.outlets.Count -eq 3) "Pro plan harus bisa memiliki total 3 outlet."
Assert-True (-not $afterUpgrade.entitlement.can_create_more) "Setelah 3 outlet, Pro plan harus mencapai limit."

Write-Host "Ensuring fourth outlet is blocked on Pro limit..."
$proRejected = $false
try {
  Invoke-RestMethod `
    -Uri "$BaseUrl/api/v1/outlets" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body (@{
      name = "Cabang Barat"
      code = "BRT"
      address = "Jl. Barat"
      phone_number = "0210000005"
    } | ConvertTo-Json) | Out-Null
} catch {
  $proRejected = $_.Exception.Message -like "*403*"
}

Assert-True $proRejected "Outlet keempat harus ditolak pada plan Pro."

Write-Host "`nOutlet flow test completed successfully."
