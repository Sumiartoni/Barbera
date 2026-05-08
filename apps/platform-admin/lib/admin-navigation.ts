export type AdminSectionId =
  | "overview"
  | "tenants"
  | "tenant-detail"
  | "tenant-override"
  | "suspension"
  | "plans"
  | "pricing"
  | "coupons"
  | "subscriptions"
  | "invoices"
  | "payments"
  | "manual-confirmation"
  | "usage-metering"
  | "quota-limits"
  | "feature-flags"
  | "access-control"
  | "admin-users"
  | "wa-health"
  | "system-status"
  | "audit-logs"
  | "incident-logs"
  | "blocked-tenants"
  | "login-activity"
  | "security-settings"
  | "support"
  | "announcements"
  | "maintenance";

export type AdminNavItem = {
  id: AdminSectionId;
  label: string;
  href: string;
};

export type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavSections: AdminNavSection[] = [
  {
    label: "Platform",
    items: [
      { id: "overview", label: "Overview", href: "/internal-admin/overview" },
      { id: "tenants", label: "Tenants", href: "/internal-admin/tenants" },
      { id: "tenant-detail", label: "Tenant Detail", href: "/internal-admin/tenant-detail" },
      { id: "tenant-override", label: "Tenant Override", href: "/internal-admin/tenant-override" },
      { id: "suspension", label: "Suspension / Reactivation", href: "/internal-admin/suspension" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { id: "plans", label: "Plans", href: "/internal-admin/plans" },
      { id: "pricing", label: "Pricing", href: "/internal-admin/pricing" },
      { id: "coupons", label: "Coupons", href: "/internal-admin/coupons" },
      { id: "subscriptions", label: "Subscriptions", href: "/internal-admin/subscriptions" },
      { id: "invoices", label: "Invoices", href: "/internal-admin/invoices" },
      { id: "payments", label: "Payments", href: "/internal-admin/payments" },
      { id: "manual-confirmation", label: "Manual Confirmation", href: "/internal-admin/manual-confirmation" },
    ],
  },
  {
    label: "Control",
    items: [
      { id: "usage-metering", label: "Usage Metering", href: "/internal-admin/usage-metering" },
      { id: "quota-limits", label: "Quota & Limits", href: "/internal-admin/quota-limits" },
      { id: "feature-flags", label: "Feature Flags", href: "/internal-admin/feature-flags" },
      { id: "access-control", label: "Access Control", href: "/internal-admin/access-control" },
      { id: "admin-users", label: "Admin Users", href: "/internal-admin/admin-users" },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "wa-health", label: "WhatsApp Session Health", href: "/internal-admin/wa-health" },
      { id: "system-status", label: "System Status", href: "/internal-admin/system-status" },
    ],
  },
  {
    label: "Security",
    items: [
      { id: "audit-logs", label: "Audit Logs", href: "/internal-admin/audit-logs" },
      { id: "incident-logs", label: "Incident Logs", href: "/internal-admin/incident-logs" },
      { id: "blocked-tenants", label: "Blocked Tenants", href: "/internal-admin/blocked-tenants" },
      { id: "login-activity", label: "Login Activity", href: "/internal-admin/login-activity" },
      { id: "security-settings", label: "Security Settings", href: "/internal-admin/security-settings" },
    ],
  },
  {
    label: "Support",
    items: [
      { id: "support", label: "Support Tickets", href: "/internal-admin/support" },
      { id: "announcements", label: "Announcements", href: "/internal-admin/announcements" },
      { id: "maintenance", label: "Maintenance Mode", href: "/internal-admin/maintenance" },
    ],
  },
];

const adminSectionLookup = new Map<AdminSectionId, AdminNavItem>(
  adminNavSections.flatMap((section) => section.items.map((item) => [item.id, item] as const)),
);

export function isAdminSectionId(value: string): value is AdminSectionId {
  return adminSectionLookup.has(value as AdminSectionId);
}

export function getAdminNavItem(section: AdminSectionId) {
  return adminSectionLookup.get(section) ?? null;
}
