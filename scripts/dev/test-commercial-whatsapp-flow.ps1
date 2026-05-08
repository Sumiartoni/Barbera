param(
  [string]$ApiBaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" }),
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

function Invoke-Json {
  param(
    [string]$Uri,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  $invokeParams = @{
    Uri     = $Uri
    Method  = $Method
    Headers = $Headers
  }

  if ($null -ne $Body) {
    $invokeParams.ContentType = "application/json"
    $invokeParams.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  return Invoke-RestMethod @invokeParams
}

function Invoke-JsonExpectFailure {
  param(
    [string]$Uri,
    [string]$Method = "GET",
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  try {
    Invoke-Json -Uri $Uri -Method $Method -Headers $Headers -Body $Body | Out-Null
    return $null
  } catch {
    if ($_.ErrorDetails.Message) {
      return ($_.ErrorDetails.Message | ConvertFrom-Json)
    }
    throw
  }
}

$ts = Get-Date -Format "yyyyMMddHHmmss"
$couponKey = "AUTO$($ts.Substring($ts.Length - 6))"
$email = "core-$ts@example.com"

$platformHeaders = @{ "X-Platform-Admin-Key" = $PlatformAdminKey }

Write-Host "1. Membuat coupon platform..."
$coupon = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/resources/coupon" `
  -Method Post `
  -Headers $platformHeaders `
  -Body @{
    resource_key = $couponKey
    name = "Coupon $couponKey"
    status = "active"
    config = @{
      discount_type = "percent"
      discount_value = 10
      applies_to = "pro,plus"
      max_redemptions = 100
      max_discount_idr = 50000
    }
  }

Assert-True ($coupon.resource_key -eq $couponKey) "Coupon platform gagal dibuat."

Write-Host "2. Register tenant baru..."
$register = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/auth/register" `
  -Method Post `
  -Body @{
    barbershop_name = "Barbera Flow $ts"
    full_name = "Flow Owner"
    email = $email
    phone_number = "0818$($ts.Substring($ts.Length - 8))"
    password = "Password123!"
  }

$tenantHeaders = @{ Authorization = "Bearer $($register.access_token)" }

Write-Host "3. Verifikasi tenant baru masih Free..."
$billingSummary = Invoke-Json -Uri "$ApiBaseUrl/api/v1/billing/summary" -Headers $tenantHeaders
Assert-True ($billingSummary.plan_code -eq "free") "Tenant baru seharusnya mulai dari paket Free."

Write-Host "4. Verifikasi fitur Pro terkunci di paket Free..."
$campaignFailure = Invoke-JsonExpectFailure `
  -Uri "$ApiBaseUrl/api/v1/resources/campaign" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    name = "Campaign Free"
    status = "active"
    config = @{
      audience = "dormant_30d"
      offer = "Diskon 10%"
      message = "Balik minggu ini"
    }
  }

Assert-True (($campaignFailure.error.code -eq "feature_unavailable")) "Campaign harus terkunci pada paket Free."

Write-Host "5. Membuat order upgrade dengan coupon..."
$order = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/billing/orders" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    plan_code = "pro"
    billing_cycle = "monthly"
    coupon_code = $couponKey
    payment_channel = "manual_qris"
    notes = "auto smoke"
  }

Assert-True ($order.discount_amount_idr -gt 0) "Coupon tidak terpakai pada billing order."
Assert-True ($order.status -eq "pending_payment") "Order baru harus pending_payment."

Write-Host "6. Menandai order sebagai paid dari panel super admin..."
$paidOrder = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/billing-orders/$($order.id)/status" `
  -Method Post `
  -Headers $platformHeaders `
  -Body @{
    status = "paid"
  }

Assert-True ($paidOrder.status -eq "paid") "Status order gagal diubah menjadi paid."

Write-Host "7. Verifikasi tenant sudah naik ke Pro..."
$upgradedSummary = Invoke-Json -Uri "$ApiBaseUrl/api/v1/billing/summary" -Headers $tenantHeaders
Assert-True ($upgradedSummary.plan_code -eq "pro") "Tenant seharusnya sudah naik ke Pro."
Assert-True ([int]$upgradedSummary.max_outlets -ge 3) "Limit outlet Pro tidak sesuai."

Write-Host "8. Membuat barber dan akses POS..."
$barber = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/barbers" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    full_name = "Barber Flow"
    phone_number = "081211110999"
    sort_order = 1
    status = "active"
  }

$access = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/barber-access" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    barber_id = $barber.id
    pin = "2468"
  }

Assert-True ($access.access_code -like "BRB-*") "Akses POS barber gagal dibuat."

Write-Host "9. Membuat shift barber..."
$shift = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/shifts" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    barber_id = $barber.id
    starts_at = "2026-04-06T02:00:00Z"
    ends_at = "2026-04-06T10:00:00Z"
    status = "scheduled"
    notes = "Shift pagi otomatis"
  }

Assert-True ($shift.status -eq "scheduled") "Shift gagal dibuat."

Write-Host "10. Menyimpan konfigurasi WhatsApp owner..."
$waConfig = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/whatsapp/config" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    linked_name = "Owner Flow"
    linked_number = "081234567890"
    owner_commands_enabled = $true
    default_queue_message = "Halo, ini link antrean: {{queue_link}}"
    default_reminder_footer = "Kirim HELP dari chat Message Yourself."
  }

Assert-True ($waConfig.owner_commands_enabled -eq $true) "Konfigurasi WhatsApp owner gagal disimpan."

Write-Host "11. Membuat QR pairing WhatsApp..."
$waPair = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/whatsapp/session/pair-qr" `
  -Method Post `
  -Headers $tenantHeaders

Assert-True (-not [string]::IsNullOrWhiteSpace($waPair.pairing_qr)) "QR pairing WhatsApp gagal dibuat."

Write-Host "12. Menjalankan command WhatsApp owner..."
$waExecute = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/whatsapp/execute" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    command = "QUEUE LINK"
    source = "script"
  }

Assert-True (($waExecute.output -like "*http*")) "Command WhatsApp owner tidak menghasilkan link antrean."

$waLogs = Invoke-Json -Uri "$ApiBaseUrl/api/v1/whatsapp/logs" -Headers $tenantHeaders
Assert-True (($waLogs.logs.Count -ge 1)) "Log WhatsApp owner seharusnya tercatat."

Write-Host ""
Write-Host "Smoke flow sukses." -ForegroundColor Green
[pscustomobject]@{
  tenant_email = $email
  coupon_code = $couponKey
  access_code = $access.access_code
  pos_pin = "2468"
  public_queue = $register.tenant.public_queue_id
  upgraded_plan = $upgradedSummary.plan_code
} | ConvertTo-Json -Depth 4
