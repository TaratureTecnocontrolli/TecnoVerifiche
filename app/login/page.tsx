import Image from "next/image";
import LoginForm from "@/components/LoginForm";
import { APP_BRAND } from "@/lib/brand";
import { isViOnlyMode } from "@/lib/app-mode";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function LoginPage() {
  return (
    <main className="tc-login">
      <section className="tc-login-card">
        <Image src="/images/tecnocontrolli-logo.png" alt="Tecnocontrolli" width={314} height={160} style={{width: "136px", height: "auto"}} priority />
        <p className="tc-eyebrow mt-5">{APP_BRAND.suiteName}</p>
        <h1 className="text-3xl font-extrabold text-slate-900">{APP_BRAND.companyName}</h1>
        <p className="mt-1 text-xl font-bold text-red-700">{APP_BRAND.moduleName}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{APP_BRAND.moduleDescription}</p>
        <div className="my-6 border-t border-slate-200 pt-5"><h2 className="text-lg font-bold text-slate-900">Accedi</h2><p className="mt-1 text-sm text-slate-600">{isViOnlyMode ? "Ambiente Verifiche Interne" : "Area operativa"}</p></div>
        <LoginForm />
        <p className="mt-6 text-xs italic text-slate-500">{APP_BRAND.claim}</p>
      </section>
    </main>
  );
}
