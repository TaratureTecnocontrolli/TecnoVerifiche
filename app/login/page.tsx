import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            TecnoVerifiche
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Accesso gestionale
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Inserisci le credenziali per effettuare l'accesso.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
