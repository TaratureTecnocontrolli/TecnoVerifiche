import { redirect } from "next/navigation";

export default function ScadenzeCampioniRedirectPage() {
  redirect("/strumenti-campione");

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

}

