import { notFound } from "next/navigation";
import { ReviewClient } from "@/components/ReviewClient";
import { reviewView } from "@/lib/queries";

export const metadata = { title: "Review" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await reviewView(id);
  if (!v) notFound();
  return <ReviewClient v={v} />;
}
