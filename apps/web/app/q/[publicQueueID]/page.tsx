import { PublicQueuePageClient } from "../../../components/public-queue-page-client";

export default async function PublicQueuePage({
  params,
}: {
  params: Promise<{ publicQueueID: string }>;
}) {
  const { publicQueueID } = await params;
  return <PublicQueuePageClient publicQueueID={publicQueueID} />;
}
