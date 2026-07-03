import { redirect, notFound } from "next/navigation";

export default async function BusinessSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Validate slug format: only allow alphanumeric, dash, underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    notFound();
  }
  redirect(`/?tenant=${encodeURIComponent(slug)}`);
}
