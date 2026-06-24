import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES = ["admin", "coordinator", "teacher", "student"] as const;
type AppRole = (typeof ROLES)[number];

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const getAdminContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");

    // count admins (admin can read all roles; non-admin can still see own; use admin client for the count)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    return { isAdmin, adminCount: count ?? 0 };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An admin already exists");
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListSchools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: schools } = await supabaseAdmin
      .from("schools")
      .select("id, name, location, is_visible, created_at")
      .order("name");
    const { data: scans } = await supabaseAdmin
      .from("waste_scans")
      .select("school_id, points_awarded");
    const counts = new Map<string, { scans: number; points: number }>();
    for (const s of scans ?? []) {
      if (!s.school_id) continue;
      const e = counts.get(s.school_id) ?? { scans: 0, points: 0 };
      e.scans += 1;
      e.points += s.points_awarded ?? 0;
      counts.set(s.school_id, e);
    }
    return (schools ?? []).map((s) => ({
      ...s,
      scans: counts.get(s.id)?.scans ?? 0,
      points: counts.get(s.id)?.points ?? 0,
    }));
  });

export const adminCreateSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ name: z.string().min(1).max(120), location: z.string().max(120).optional().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("schools")
      .insert({ name: data.name, location: data.location ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(120).optional(),
        location: z.string().max(120).optional().nullable(),
        is_visible: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: { name?: string; location?: string | null; is_visible?: boolean } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.location !== undefined) patch.location = data.location;
    if (data.is_visible !== undefined) patch.is_visible = data.is_visible;
    const { error } = await context.supabase.from("schools").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("schools").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, points, school_id, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: schools } = await supabaseAdmin.from("schools").select("id, name");
    const schoolMap = new Map((schools ?? []).map((s) => [s.id, s.name]));
    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      points: p.points,
      school_id: p.school_id,
      school_name: p.school_id ? schoolMap.get(p.school_id) ?? null : null,
      roles: roleMap.get(p.id) ?? [],
      created_at: p.created_at,
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(ROLES),
        action: z.enum(["add", "remove"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.action === "add") {
      const { error } = await context.supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    } else {
      // prevent removing the last admin
      if (data.role === "admin") {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) <= 1) throw new Error("Cannot remove the last admin");
      }
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminAssignSchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ userId: z.string().uuid(), schoolId: z.string().uuid().nullable() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ school_id: data.schoolId })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });