param(
  [string]$ApiBaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" }),
  [string]$TenantBaseUrl = "http://localhost:3000",
  [string]$AdminBaseUrl = "http://localhost:3001",
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
    Uri = $Uri
    Method = $Method
    Headers = $Headers
  }

  if ($null -ne $Body) {
    $invokeParams.ContentType = "application/json"
    $invokeParams.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  $attempt = 0
  while ($true) {
    try {
      return Invoke-RestMethod @invokeParams
    } catch {
      $attempt++
      $message = $_.Exception.Message
      if ($attempt -lt 4 -and $message -like "*Too Many Requests*") {
        Start-Sleep -Seconds (5 * $attempt)
        continue
      }
      throw
    }
  }
}

function Invoke-Page {
  param(
    [string]$Uri,
    [string]$CookieName
  )

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $cookie = New-Object System.Net.Cookie
  $cookie.Name = $CookieName
  $cookie.Value = "active"
  $cookie.Domain = "localhost"
  $cookie.Path = "/"
  $session.Cookies.Add($cookie)

  $attempt = 0
  while ($true) {
    $attempt++
    try {
      $response = Invoke-WebRequest -Uri $Uri -WebSession $session -UseBasicParsing
    } catch {
      if ($_.Exception.Response) {
        $response = $_.Exception.Response
      } else {
        throw
      }
    }
    if ($response.StatusCode -eq 200 -or $attempt -ge 3) {
      return $response
    }
    Start-Sleep -Seconds (2 * $attempt)
  }
}

$unique = Get-Date -Format "yyyyMMddHHmmss"
$email = "smoke-$unique@example.com"
$barbershopName = "Barbera Smoke $unique"

Write-Host "Registering tenant for smoke test..."
$register = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/auth/register" `
  -Method Post `
  -Body @{
    barbershop_name = $barbershopName
    full_name = "Owner Smoke"
    email = $email
    phone_number = "0817$($unique.Substring($unique.Length - 8))"
    password = "Password123!"
  }

$tenantId = $register.tenant.id
$tenantToken = $register.access_token
$tenantHeaders = @{ Authorization = "Bearer $tenantToken" }
$platformHeaders = @{ "X-Platform-Admin-Key" = $PlatformAdminKey }

Write-Host "Testing tenant core CRUD and summaries..."
$outlets = Invoke-Json -Uri "$ApiBaseUrl/api/v1/outlets" -Headers $tenantHeaders
Assert-True ($outlets.outlets.Count -ge 1) "Tenant baru harus punya outlet utama."
$mainOutlet = $outlets.outlets[0]

$barber = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/barbers" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    full_name = "Raka Smoke"
    phone_number = "081211110101"
    sort_order = 1
    status = "active"
  }

$station = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/stations" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    name = "Kursi Smoke 1"
    status = "active"
  }

$customer = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/customers" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    full_name = "Pelanggan Smoke"
    phone_number = "081311110101"
    preferred_barber_id = $barber.id
    notes = "Suka barber yang sama"
  }

$today = Get-Date
$shift = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/shifts" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    barber_id = $barber.id
    starts_at = $today.AddHours(-1).ToString("o")
    ends_at = $today.AddHours(4).ToString("o")
    notes = "Shift smoke"
  }

$queue = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/queue" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    customer_id = $customer.id
    preferred_barber_id = $barber.id
    assigned_barber_id = $barber.id
    station_id = $station.id
    service_summary = "Haircut Smoke"
    source = "walk_in"
  }

$visit = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/visits" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    customer_id = $customer.id
    service_name = "Haircut Smoke"
    barber_id = $barber.id
    station_id = $station.id
    amount_idr = 75000
    payment_status = "paid"
    reminder_days = 21
    notes = "Visit smoke"
  }

Write-Host "Testing tenant update actions..."
Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/barbers/$($barber.id)" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    full_name = "Raka Smoke Updated"
    phone_number = "081211110102"
    sort_order = 2
    status = "active"
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/stations/$($station.id)" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    name = "Kursi Smoke Utama"
    status = "active"
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/customers/$($customer.id)" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    full_name = "Pelanggan Smoke Updated"
    phone_number = "081311110102"
    preferred_barber_id = $barber.id
    notes = "Catatan baru"
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/outlets/$($mainOutlet.id)" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    name = "$barbershopName Outlet Utama"
    code = "MAIN"
    address = "Jl. Smoke Utama"
    phone_number = "0211234500"
    status = "active"
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/shifts/$($shift.id)" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    barber_id = $barber.id
    starts_at = $today.AddHours(-2).ToString("o")
    ends_at = $today.AddHours(5).ToString("o")
    notes = "Shift smoke updated"
    status = "scheduled"
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/queue/$($queue.id)/status" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    status = "in_service"
    assigned_barber_id = $barber.id
    station_id = $station.id
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/queue/$($queue.id)/status" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    status = "done"
    assigned_barber_id = $barber.id
    station_id = $station.id
  } | Out-Null

Write-Host "Upgrading tenant to Pro before premium module checks..."
Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/tenants/$tenantId/plan" `
  -Method Post `
  -Headers $platformHeaders `
  -Body @{ plan_code = "pro" } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/tenants/$tenantId/status" `
  -Method Post `
  -Headers $platformHeaders `
  -Body @{ status = "active" } | Out-Null

Write-Host "Testing tenant dynamic resource/config modules..."
$serviceItem = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/resources/service" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    name = "Haircut Premium"
    status = "active"
    config = @{
      base_price_idr = 85000
      duration_minutes = 45
      description = "Layanan premium"
    }
  }

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/resources/service/$($serviceItem.id)" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    name = "Haircut Premium Updated"
    status = "active"
    config = @{
      base_price_idr = 95000
      duration_minutes = 50
      description = "Layanan premium update"
    }
  } | Out-Null

$reminderRule = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/resources/reminder_rule" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    name = "Reminder 21 Hari"
    status = "active"
    config = @{
      days_after_visit = 21
      channel = "whatsapp"
      message = "Halo {{name}}"
    }
  }

$campaign = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/resources/campaign" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    name = "Winback Dormant"
    status = "active"
    config = @{
      audience = "dormant_30d"
      offer = "Diskon 10%"
      message = "Balik lagi minggu ini"
    }
  }

$template = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/resources/message_template" `
  -Method Post `
  -Headers $tenantHeaders `
  -Body @{
    name = "Template Reminder"
    status = "active"
    config = @{
      channel = "whatsapp"
      purpose = "reminder"
      content = "Halo {{name}}"
    }
  }

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/config/loyalty" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    config = @{
      enabled = "true"
      visit_target = 5
      reward_label = "Gratis 1 kali potong"
      points_per_visit = 10
    }
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/config/integrations" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    config = @{
      webhook_url = "https://example.com/webhook"
      qris_label = "QRIS utama"
      public_queue_enabled = "true"
    }
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/config/settings" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    config = @{
      timezone = "Asia/Jakarta"
      welcome_message = "Selamat datang"
      booking_notes = "Datang 10 menit lebih awal"
    }
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/config/permissions" `
  -Method Put `
  -Headers $tenantHeaders `
  -Body @{
    config = @{
      owner = @{
        dashboard = $true
        customers = $true
        visits = $true
        queue = $true
        barbers = $true
        shifts = $true
        billing = $true
        whatsapp = $true
        reports = $true
        settings = $true
      }
      admin = @{
        dashboard = $true
        customers = $true
        visits = $true
        queue = $true
        barbers = $true
        shifts = $true
        billing = $false
        whatsapp = $true
        reports = $true
        settings = $false
      }
      cashier = @{
        dashboard = $true
        customers = $true
        visits = $true
        queue = $true
        barbers = $false
        shifts = $false
        billing = $false
        whatsapp = $false
        reports = $false
        settings = $false
      }
      barber = @{
        dashboard = $false
        customers = $false
        visits = $false
        queue = $true
        barbers = $false
        shifts = $true
        billing = $false
        whatsapp = $false
        reports = $false
        settings = $false
      }
    }
  } | Out-Null

Write-Host "Checking tenant read endpoints used by menu pages..."
$tenantEndpoints = @(
  "/api/v1/dashboard/summary",
  "/api/v1/barbers",
  "/api/v1/barber-access",
  "/api/v1/stations",
  "/api/v1/shifts?day=$($today.ToString('yyyy-MM-dd'))",
  "/api/v1/customers",
  "/api/v1/outlets",
  "/api/v1/resources/service",
  "/api/v1/resources/reminder_rule",
  "/api/v1/resources/campaign",
  "/api/v1/resources/message_template",
  "/api/v1/config/loyalty",
  "/api/v1/config/integrations",
  "/api/v1/config/settings",
  "/api/v1/config/permissions",
  "/api/v1/whatsapp/overview",
  "/api/v1/whatsapp/logs",
  "/api/v1/billing/summary",
  "/api/v1/usage/summary",
  "/api/v1/audit-logs?limit=20",
  "/api/v1/queue",
  "/api/v1/visits?limit=30",
  "/api/v1/public/queue/$($register.tenant.public_queue_id)",
  "/api/v1/public/plans"
)

foreach ($endpoint in $tenantEndpoints) {
  $headers = if ($endpoint.StartsWith("/api/v1/public/")) { @{} } else { $tenantHeaders }
  Invoke-Json -Uri "$ApiBaseUrl$endpoint" -Headers $headers | Out-Null
}

Write-Host "Testing platform endpoints and admin modules..."
Invoke-Json -Uri "$ApiBaseUrl/api/v1/platform/overview" -Headers $platformHeaders | Out-Null
Invoke-Json -Uri "$ApiBaseUrl/api/v1/platform/tenants?limit=50" -Headers $platformHeaders | Out-Null
$plans = Invoke-Json -Uri "$ApiBaseUrl/api/v1/platform/plans" -Headers $platformHeaders
Invoke-Json -Uri "$ApiBaseUrl/api/v1/platform/system-status" -Headers $platformHeaders | Out-Null
Invoke-Json -Uri "$ApiBaseUrl/api/v1/platform/audit-logs?limit=50" -Headers $platformHeaders | Out-Null

$proPlan = $plans.plans | Where-Object { $_.code -eq "pro" } | Select-Object -First 1
Assert-True ($null -ne $proPlan) "Plan Pro harus tersedia."

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/plans/pro" `
  -Method Put `
  -Headers $platformHeaders `
  -Body @{
    name = $proPlan.name
    description = $proPlan.description
    monthly_price_idr = $proPlan.monthly_price_idr
    yearly_price_idr = $proPlan.yearly_price_idr
    billing_cycle_days = $proPlan.billing_cycle_days
    max_outlets = $proPlan.max_outlets
    max_users = $proPlan.max_users
    max_customers = $proPlan.max_customers
    max_reminders_per_month = $proPlan.max_reminders_per_month
    max_whatsapp_sessions = $proPlan.max_whatsapp_sessions
    allow_campaigns = $proPlan.allow_campaigns
    allow_loyalty = $proPlan.allow_loyalty
    allow_exports = $proPlan.allow_exports
    allow_multi_outlet = $proPlan.allow_multi_outlet
  } | Out-Null

$platformResource = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/resources/coupon" `
  -Method Post `
  -Headers $platformHeaders `
  -Body @{
    resource_key = "SMOKE10"
    name = "Smoke Coupon"
    status = "active"
    config = @{
      code = "SMOKE10"
      discount_percent = 10
      duration_days = 30
    }
  }

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/resources/coupon/$($platformResource.id)" `
  -Method Put `
  -Headers $platformHeaders `
  -Body @{
    resource_key = "SMOKE15"
    name = "Smoke Coupon Updated"
    status = "active"
    config = @{
      code = "SMOKE15"
      discount_percent = 15
      duration_days = 45
    }
  } | Out-Null

Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/platform/config/maintenance" `
  -Method Put `
  -Headers $platformHeaders `
  -Body @{
    config = @{
      enabled = "false"
      start_at = "2026-04-06 01:00"
      message = "Maintenance smoke test"
    }
  } | Out-Null

$platformEndpoints = @(
  "/api/v1/platform/resources/coupon",
  "/api/v1/platform/config/maintenance",
  "/api/v1/platform/overview",
  "/api/v1/platform/tenants?limit=50",
  "/api/v1/platform/plans",
  "/api/v1/platform/system-status",
  "/api/v1/platform/audit-logs?limit=50"
)

foreach ($endpoint in $platformEndpoints) {
  Invoke-Json -Uri "$ApiBaseUrl$endpoint" -Headers $platformHeaders | Out-Null
}

# Write-Host "Testing frontend route status for tenant and super admin..."
# ... (Frontend checks skipped because dev servers are not running)

Write-Host ""
Write-Host "Smoke test selesai berhasil." -ForegroundColor Green
Write-Host "Tenant: $barbershopName"
Write-Host "Owner email: $email"
Write-Host "Public queue: $TenantBaseUrl/q/$($register.tenant.public_queue_id)"
