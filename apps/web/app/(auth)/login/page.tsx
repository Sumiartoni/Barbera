import { Suspense } from "react";
import { AuthPageClient } from "../../../components/auth-page-client";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; tab?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense fallback={
      <main className="min-h-screen w-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C8A464] border-t-transparent rounded-full animate-spin" />
      </main>
    }>
      <AuthPageClient nextPath={params.next} />
    </Suspense>
  );
}
