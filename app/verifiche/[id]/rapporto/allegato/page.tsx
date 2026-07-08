import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function OldTechnicalSectionRedirectPage({
  params,
}: PageProps) {
  const { id } = await params;

  redirect(`/verifiche/${id}/rapporto/sezione-tecnica`);
}
