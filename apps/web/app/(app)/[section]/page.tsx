import { notFound } from "next/navigation";

import { TenantDynamicPageClient } from "../../../components/tenant-dynamic-page-client";

const dynamicSections = new Set([
  "services",
  "payments-history",
  "invoices",
  "reminder-rules",
  "reminder-queue",
  "campaigns",
  "loyalty",
  "segments",
  "dormant",
  "templates",
  "inbox",
  "broadcast",
  "daily-report",
  "repeat-customer",
  "retention-report",
  "revenue",
  "barber-performance",
  "roles",
  "permissions",
  "billing",
  "usage",
  "integrations",
  "audit",
  "settings",
  "help",
  "changelog",
]);

export default async function TenantDynamicSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;

  if (!dynamicSections.has(section)) {
    notFound();
  }

  return <TenantDynamicPageClient section={section as Parameters<typeof TenantDynamicPageClient>[0]["section"]} />;
}
