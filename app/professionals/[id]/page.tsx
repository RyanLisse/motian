import { redirect } from "next/navigation";

/**
 * Legacy route — /professionals/[id] is now /kandidaten/[id].
 * 301-style server redirect preserving the id param.
 */
export default async function ProfessionalDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/kandidaten/${id}`);
}
