param(
  [string]$ApiBaseUrl = $(if ($env:BARBERA_API_BASE_URL) { $env:BARBERA_API_BASE_URL } else { "http://[::1]:8080" })
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

$ts = Get-Date -Format "yyyyMMddHHmmss"
$email = "onboarding-$ts@example.com"
$register = Invoke-Json `
  -Uri "$ApiBaseUrl/api/v1/auth/register" `
  -Method Post `
  -Body @{
    barbershop_name = "Barbera Onboarding $ts"
    full_name = "Owner Onboarding"
    email = $email
    phone_number = "0819$($ts.Substring($ts.Length - 8))"
    password = "Password123!"
  }

$tenantHeaders = @{ Authorization = "Bearer $($register.access_token)" }

$settings = Invoke-Json -Uri "$ApiBaseUrl/api/v1/config/settings" -Headers $tenantHeaders
$integrations = Invoke-Json -Uri "$ApiBaseUrl/api/v1/config/integrations" -Headers $tenantHeaders
$permissions = Invoke-Json -Uri "$ApiBaseUrl/api/v1/config/permissions" -Headers $tenantHeaders
$whatsapp = Invoke-Json -Uri "$ApiBaseUrl/api/v1/whatsapp/overview" -Headers $tenantHeaders
$templates = Invoke-Json -Uri "$ApiBaseUrl/api/v1/resources/message_template" -Headers $tenantHeaders
$reminderRules = Invoke-Json -Uri "$ApiBaseUrl/api/v1/resources/reminder_rule" -Headers $tenantHeaders
$services = Invoke-Json -Uri "$ApiBaseUrl/api/v1/resources/service" -Headers $tenantHeaders

Assert-True ($settings.config.opening_hours -eq "10:00 - 21:00") "Default opening hours belum terpasang."
Assert-True ($integrations.config.owner_command_webhook_url -like "*$($register.tenant.public_queue_id)") "Owner command webhook URL belum sesuai."
Assert-True ($permissions.config.owner.dashboard -eq $true) "Permission default owner.dashboard harus true."
Assert-True ($whatsapp.config.default_queue_message -like "*{{queue_link}}*") "Default queue message harus menyertakan placeholder queue link."
Assert-True ($templates.items.Count -ge 4) "Template pesan default minimal 4 item."
Assert-True (@($templates.items | Where-Object { $_.name -eq "Template Link Antrean" }).Count -ge 1) "Template Link Antrean belum tersedia."
Assert-True (@($templates.items | Where-Object { $_.name -eq "Template Reminder Cukur Ulang" }).Count -ge 1) "Template Reminder Cukur Ulang belum tersedia."
Assert-True (@($reminderRules.items | Where-Object { $_.name -eq "Reminder 21 Hari" }).Count -ge 1) "Reminder default 21 hari belum tersedia."
Assert-True (@($services.items | Where-Object { $_.name -eq "Potong Rambut Regular" }).Count -ge 1) "Service default belum tersedia."

Write-Host ""
Write-Host "Onboarding defaults sukses." -ForegroundColor Green
[pscustomobject]@{
  tenant_email = $email
  public_queue = $register.tenant.public_queue_id
  template_count = $templates.items.Count
  reminder_rule_count = $reminderRules.items.Count
  service_count = $services.items.Count
} | ConvertTo-Json -Depth 4
