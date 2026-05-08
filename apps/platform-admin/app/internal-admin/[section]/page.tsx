import { notFound } from "next/navigation";

import { AdminSectionContent } from "../../../components/admin-pages";
import { AdminShell } from "../../../components/admin-shell";
import { isAdminSectionId, type AdminSectionId } from "../../../lib/admin-navigation";
import { loadPlatformDataset } from "../../../lib/platform-data";

export default async function InternalAdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ tenant?: string | string[] }>;
}) {
  const { section } = await params;
  const resolvedSearchParams = await searchParams;

  if (!isAdminSectionId(section)) {
    notFound();
  }

  const data = await loadPlatformDataset();

  return (
    <AdminShell>
      <AdminSectionContent
        section={section as AdminSectionId}
        data={data}
        focusTenantID={Array.isArray(resolvedSearchParams.tenant) ? resolvedSearchParams.tenant[0] : resolvedSearchParams.tenant}
      />
    </AdminShell>
  );
}
