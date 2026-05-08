param(
  [string]$ApiBaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" }),
  [string]$PlatformAdminKey = $(if ($env:PLATFORM_ADMIN_API_KEY) { $env:PLATFORM_ADMIN_API_KEY } else { "dev-platform-admin-key-change-me" }),
  [string]$ForwarderSecret = "barbera-forwarder-smoke"
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

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$email = "payment-$timestamp@example.com"
$platformHeaders = @{ "X-Platform-Admin-Key" = $PlatformAdminKey }

Write-Host "1. Menyimpan konfigurasi manual QRIS platform..."
Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/config/manual-qris-payment" `
  -Method Put `
  -Headers $platformHeaders `
  -Body @{
    config = @{
      wallet_provider = "DANA"
      wallet_account = "081234567890"
      qris_label = "QRIS DANA Pribadi"
      qris_owner_name = "Owner Barbera"
      qris_payload = "00020101021126670016COM.NOBUBANK.WWW01189360050300000879140214543138211154510303UME51440014ID.CO.QRIS.WWW0215ID20253973281400303UME5204541153033605802ID5910OWNER TEST6013JAKARTA BARAT61051150062070703A016304BEEF"
      qris_image_url = "https://example.com/qris-dana.png"
      forwarder_secret = $ForwarderSecret
      payment_window_minutes = 30
      match_grace_minutes = 10
      unique_code_min = 1
      unique_code_max = 499
    }
  } | Out-Null

Write-Host "2. Register tenant baru..."
$register = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/auth/register" `
  -Method Post `
  -Body @{
    barbershop_name = "Barbera Payment $timestamp"
    full_name = "Payment Owner"
    email = $email
    phone_number = "0819$($timestamp.Substring($timestamp.Length - 8))"
    password = "Password123!"
  }

$tenantHeaders = @{ Authorization = "Bearer $($register.access_token)" }

Write-Host "3. Membuat order manual QRIS..."
$order = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/billing/orders" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    plan_code = "pro"
    billing_cycle = "monthly"
    payment_channel = "manual_qris"
    notes = "smoke payment forwarder"
  }

Assert-True ($order.status -eq "pending_payment") "Order baru harus pending_payment."
Assert-True ([int64]$order.payment_amount_idr -gt [int64]$order.total_amount_idr) "Nominal unik belum terbentuk."
Assert-True (-not [string]::IsNullOrWhiteSpace($order.payment_reference)) "Referensi pembayaran belum terbentuk."
Assert-True (-not [string]::IsNullOrWhiteSpace($order.metadata.payment_instructions.qris_payload)) "Raw string QRIS belum ikut ke metadata order."

Write-Host "4. Mengirim notifikasi forwarder dengan nominal unik..."
$notification = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/public/payments/manual-qris-forwarder" `
  -Method Post `
  -Body @{
    secret = $ForwarderSecret
    app_name = "Notification Forwarder"
    title = "DANA Payment Received"
    message = "Pembayaran masuk Rp $($order.payment_amount_idr)"
    sender = "DANA"
    amount_idr = $order.payment_amount_idr
    received_at = (Get-Date).ToUniversalTime().ToString("o")
    raw_payload = @{
      source = "smoke-script"
      reference = $order.payment_reference
    }
  }

Assert-True ($notification.match_status -eq "matched") "Notifikasi payment forwarder seharusnya matched."
Assert-True ($notification.order_id -eq $order.id) "Order yang matched tidak sesuai."

Write-Host "5. Verifikasi order tenant berubah paid..."
$ordersPayload = Invoke-Json -Uri "$ApiBaseUrl/api/v1/billing/orders" -Headers $tenantHeaders
$paidOrder = $ordersPayload.orders | Where-Object { $_.id -eq $order.id } | Select-Object -First 1
Assert-True ($null -ne $paidOrder) "Order tidak ditemukan setelah webhook."
Assert-True ($paidOrder.status -eq "paid") "Order belum berubah menjadi paid."
Assert-True ($paidOrder.payment_confirm_source -eq "android_forwarder") "Sumber konfirmasi tidak sesuai."
Assert-True ([int64]$paidOrder.paid_amount_idr -eq [int64]$order.payment_amount_idr) "Paid amount tidak sesuai nominal unik."

Write-Host "6. Verifikasi paket tenant aktif..."
$summary = Invoke-Json -Uri "$ApiBaseUrl/api/v1/billing/summary" -Headers $tenantHeaders
Assert-True ($summary.plan_code -eq "pro") "Tenant seharusnya sudah aktif di paket Pro."

Write-Host ""
Write-Host "Payment forwarder flow sukses." -ForegroundColor Green
[pscustomobject]@{
  tenant_email = $email
  order_id = $order.id
  payment_amount_idr = $order.payment_amount_idr
  payment_reference = $order.payment_reference
  match_status = $notification.match_status
  active_plan = $summary.plan_code
} | ConvertTo-Json -Depth 5
