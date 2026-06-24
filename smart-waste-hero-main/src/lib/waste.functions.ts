import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CATEGORIES = [
  "Plastic",
  "Paper",
  "Metal",
  "Glass",
  "Organic",
  "E-Waste",
  "Textile",
  "Mixed",
] as const;

const POINTS: Record<string, number> = {
  Plastic: 5,
  Metal: 8,
  Glass: 7,
  Organic: 6,
  Paper: 4,
  "E-Waste": 10,
  Textile: 5,
  Mixed: 1,
};

const Input = z.object({
  imageBase64: z.string().min(20),
  mimeType: z.string().default("image/jpeg"),
  schoolId: z.string().uuid().optional().nullable(),
});

export type ClassificationResult = {
  category: (typeof CATEGORIES)[number];
  subcategory: string;
  confidence: number;
  recyclability_score: number;
  environmental_impact_score: number;
  carbon_reduction_kg: number;
  disposal_recommendation: string;
  educational_insight: string;
  points_awarded: number;
  scan_id: string;
};

export const classifyWaste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }): Promise<ClassificationResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt = `You are a waste classification AI for schools and communities.
Classify the waste image into exactly one of these categories: ${CATEGORIES.join(", ")}.
Respond ONLY with valid JSON matching this exact shape:
{
  "category": one of ${JSON.stringify(CATEGORIES)},
  "subcategory": short specific item name (e.g. "Plastic Bottle", "Aluminum Can"),
  "confidence": number 0-100,
  "recyclability_score": number 0-100,
  "environmental_impact_score": number 0-100,
  "carbon_reduction_kg": number kg CO2 saved if recycled correctly (e.g. 0.25),
  "disposal_recommendation": one-sentence actionable disposal instruction,
  "educational_insight": one-sentence environmental fact for students
}`;

    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${data.mimeType};base64,${data.imageBase64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this waste item." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Add credits in Lovable Cloud billing.");
      throw new Error(`AI error ${res.status}: ${text.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned non-JSON response");
    }

    const category = (CATEGORIES as readonly string[]).includes(parsed.category as string)
      ? (parsed.category as ClassificationResult["category"])
      : "Mixed";
    const clamp = (n: unknown, max = 100) =>
      Math.max(0, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : 0));

    const result = {
      category,
      subcategory: String(parsed.subcategory ?? category),
      confidence: clamp(parsed.confidence),
      recyclability_score: clamp(parsed.recyclability_score),
      environmental_impact_score: clamp(parsed.environmental_impact_score),
      carbon_reduction_kg: Math.max(0, Number(parsed.carbon_reduction_kg) || 0),
      disposal_recommendation: String(
        parsed.disposal_recommendation ?? "Place in the appropriate recycling container.",
      ),
      educational_insight: String(
        parsed.educational_insight ?? "Sorting waste correctly helps protect our environment.",
      ),
      points_awarded: POINTS[category] ?? 2,
    };

    // fetch user's school
    let schoolId = data.schoolId ?? null;
    if (!schoolId) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("school_id")
        .eq("id", context.userId)
        .maybeSingle();
      schoolId = prof?.school_id ?? null;
    }

    const { data: inserted, error } = await context.supabase
      .from("waste_scans")
      .insert({
        user_id: context.userId,
        school_id: schoolId,
        category: result.category,
        subcategory: result.subcategory,
        confidence: result.confidence,
        recyclability_score: result.recyclability_score,
        environmental_impact_score: result.environmental_impact_score,
        carbon_reduction_kg: result.carbon_reduction_kg,
        disposal_recommendation: result.disposal_recommendation,
        educational_insight: result.educational_insight,
        points_awarded: result.points_awarded,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return { ...result, scan_id: inserted.id };
  });

export const getMyScans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("waste_scans")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, points, school_id")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: scans } = await context.supabase
      .from("waste_scans")
      .select("category, recyclability_score, carbon_reduction_kg, created_at")
      .eq("user_id", context.userId);

    const rows = scans ?? [];
    const total = rows.length;
    const categoryCounts: Record<string, number> = {};
    let carbonSaved = 0;
    let recyclableCount = 0;
    for (const r of rows) {
      categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
      carbonSaved += Number(r.carbon_reduction_kg ?? 0);
      if ((r.recyclability_score ?? 0) >= 50) recyclableCount += 1;
    }
    const recyclingRate = total ? Math.round((recyclableCount / total) * 100) : 0;

    // monthly trend (last 6 months)
    const months: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString(undefined, { month: "short" });
      const count = rows.filter((r) => {
        const cd = new Date(r.created_at as string);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length;
      months.push({ label, count });
    }

    return {
      profile,
      totalScans: total,
      points: profile?.points ?? 0,
      carbonSavedKg: Math.round(carbonSaved * 1000) / 1000,
      recyclingRate,
      categoryCounts,
      monthly: months,
    };
  });

const LeaderboardInput = z
  .object({
    from: z.string().datetime().optional().nullable(),
    to: z.string().datetime().optional().nullable(),
  })
  .optional();

export const getLeaderboard = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LeaderboardInput.parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: schools } = await supabase
      .from("schools")
      .select("id, name, location, is_visible")
      .eq("is_visible", true);

    let scansQ = supabase
      .from("waste_scans")
      .select("school_id, points_awarded, carbon_reduction_kg, recyclability_score, created_at");
    if (data?.from) scansQ = scansQ.gte("created_at", data.from);
    if (data?.to) scansQ = scansQ.lte("created_at", data.to);
    const { data: scans } = await scansQ;

    const map = new Map<string, { id: string; name: string; location: string | null; scans: number; points: number; carbon: number; recyc: number }>();
    for (const s of schools ?? []) {
      map.set(s.id, { id: s.id, name: s.name, location: s.location, scans: 0, points: 0, carbon: 0, recyc: 0 });
    }
    for (const r of scans ?? []) {
      if (!r.school_id) continue;
      const e = map.get(r.school_id);
      if (!e) continue;
      e.scans += 1;
      e.points += r.points_awarded ?? 0;
      e.carbon += Number(r.carbon_reduction_kg ?? 0);
      e.recyc += r.recyclability_score ?? 0;
    }
    const list = Array.from(map.values()).map((e) => ({
      ...e,
      carbon: Math.round(e.carbon * 1000) / 1000,
      sustainability: e.scans ? Math.round((e.recyc / e.scans + e.points / Math.max(e.scans, 1)) / 2) : 0,
    }));
    list.sort((a, b) => b.points - a.points || b.scans - a.scans);
    return list;
  });

export const listSchools = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await supabase.from("schools").select("id, name, location").order("name");
  return data ?? [];
});

export const setMySchool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ schoolId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ school_id: data.schoolId })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });