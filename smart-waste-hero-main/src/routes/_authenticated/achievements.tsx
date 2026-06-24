import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyStats } from "@/lib/waste.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({ meta: [{ title: "Achievements — EcoSort AI" }] }),
  component: AchievementsPage,
});

const BADGES = [
  { name: "Eco Starter", desc: "Complete your first scan", req: (s: number) => s >= 1 },
  { name: "Green Champion", desc: "10 scans logged", req: (s: number) => s >= 10 },
  { name: "Sustainability Hero", desc: "25 scans logged", req: (s: number) => s >= 25 },
  { name: "Waste Warrior", desc: "50 scans logged", req: (s: number) => s >= 50 },
  { name: "Eco Ambassador", desc: "100 scans logged", req: (s: number) => s >= 100 },
];

function AchievementsPage() {
  const fn = useServerFn(getMyStats);
  const q = useQuery({ queryKey: ["my-stats"], queryFn: () => fn() });
  const total = q.data?.totalScans ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Achievements</h1>
      <p className="text-muted-foreground">Earn badges as you scan and learn.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {BADGES.map((b) => {
          const earned = b.req(total);
          return (
            <Card key={b.name} className={earned ? "" : "opacity-60"}>
              <CardContent className="flex items-center gap-3 p-5">
                <span
                  className="grid h-12 w-12 place-items-center rounded-xl text-primary-foreground"
                  style={{ background: earned ? "var(--gradient-leaf)" : "var(--muted)" }}
                >
                  {earned ? <Award className="h-6 w-6" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
                </span>
                <div>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}