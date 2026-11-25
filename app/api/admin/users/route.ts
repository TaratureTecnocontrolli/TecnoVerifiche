import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

type Role = "master" | "technician";

async function requireMaster() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: NextResponse.json({ error: "Non autenticato." }, { status: 401 }) };
  }

  const admin = createAdminSupabaseClient();
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "master" || profile.is_active !== true) {
    return { error: NextResponse.json({ error: "Operazione riservata ai profili MASTER." }, { status: 403 }) };
  }

  return { admin, user };
}

function normalizeRole(value: unknown): Role {
  return value === "master" ? "master" : "technician";
}

function normalizeTechnicianId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function validateTechnicianAssignment(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  role: Role,
  technicianId: string | null
) {
  if (role !== "technician") return;
  if (!technicianId) {
    throw new Error("Per un profilo TECNICO devi associare il relativo nominativo tecnico.");
  }

  const { data, error } = await admin
    .from("calibration_technicians")
    .select("id, is_active")
    .eq("id", technicianId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Nominativo tecnico non trovato.");
  }
  if (data.is_active !== true) {
    throw new Error("Il nominativo tecnico associato non è attivo.");
  }
}

export async function GET() {
  const auth = await requireMaster();
  if ("error" in auth) return auth.error;

  const { admin } = auth;

  const [{ data: authUsers, error: usersError }, { data: profiles, error: profilesError }, { data: technicians, error: techniciansError }] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("user_profiles").select("id, role, technician_id, is_active, created_at, updated_at"),
      admin.from("calibration_technicians").select("id, full_name, email, is_active").order("full_name"),
    ]);

  if (usersError || profilesError || techniciansError) {
    return NextResponse.json(
      { error: usersError?.message || profilesError?.message || techniciansError?.message || "Errore caricamento utenti." },
      { status: 500 }
    );
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const technicianMap = new Map((technicians ?? []).map((technician) => [technician.id, technician]));

  return NextResponse.json({
    current_user_id: auth.user.id,
    users: authUsers.users.map((user) => {
      const profile = profileMap.get(user.id) ?? null;
      const technician = profile?.technician_id
        ? technicianMap.get(profile.technician_id) ?? null
        : null;

      return {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        role: profile?.role ?? null,
        technician_id: profile?.technician_id ?? null,
        technician_name: technician?.full_name ?? null,
        is_active: profile?.is_active ?? false,
      };
    }),
    technicians: technicians ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireMaster();
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = normalizeRole(body.role);
    const technicianId = normalizeTechnicianId(body.technician_id);

    if (!email) throw new Error("Inserisci l'email dell'utente.");
    if (password.length < 8) throw new Error("La password iniziale deve avere almeno 8 caratteri.");
    await validateTechnicianAssignment(admin, role, technicianId);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      throw new Error(createError?.message || "Creazione account non riuscita.");
    }

    const { error: profileError } = await admin.from("user_profiles").upsert(
      {
        id: created.user.id,
        email,
        role,
        technician_id: technicianId,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    return NextResponse.json({ ok: true, user_id: created.user.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore creazione utente." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireMaster();
  if ("error" in auth) return auth.error;
  const { admin, user: currentUser } = auth;

  try {
    const body = await request.json();
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
    const role = normalizeRole(body.role);
    const technicianId = normalizeTechnicianId(body.technician_id);
    const isActive = body.is_active !== false;
    const password = typeof body.password === "string" ? body.password : "";

    if (!userId) throw new Error("Utente non valido.");
    if (userId === currentUser.id && (role !== "master" || !isActive)) {
      throw new Error("Non puoi disattivare o retrocedere il profilo MASTER con cui sei attualmente connesso.");
    }
    await validateTechnicianAssignment(admin, role, technicianId);

    const { data: authUserData, error: authUserError } =
      await admin.auth.admin.getUserById(userId);

    if (authUserError || !authUserData.user) {
      throw new Error(authUserError?.message || "Account Auth non trovato.");
    }

    const profileEmail = authUserData.user.email?.trim().toLowerCase() ||
      `utente-${userId}@local.invalid`;

    const { error: profileError } = await admin
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          email: profileEmail,
          role,
          technician_id: technicianId,
          is_active: isActive,
        },
        { onConflict: "id" }
      );

    if (profileError) throw new Error(profileError.message);

    if (password) {
      if (password.length < 8) throw new Error("La nuova password deve avere almeno 8 caratteri.");
      const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password });
      if (passwordError) throw new Error(passwordError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore aggiornamento utente." },
      { status: 400 }
    );
  }
}
