import { redirect } from "next/navigation";

export default function InternalAdminIndexPage() {
  redirect("/internal-admin/overview");
}
