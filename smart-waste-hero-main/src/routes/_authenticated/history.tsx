import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyScans } from "@/lib/waste.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Scan History — EcoSort AI" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const fn = useServerFn(getMyScans);
  const q = useQuery({ queryKey: ["my-scans"], queryFn: () => fn() });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Scan history</h1>
      <p className="text-muted-foreground">Every scan you've made.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent scans</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !q.data?.length ? (
            <p className="text-sm text-muted-foreground">No scans yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {q.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{s.category}</Badge>
                      <span className="font-medium">{s.subcategory ?? "—"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()} · {Math.round(Number(s.confidence))}% confidence
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">+{s.points_awarded} pts</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(s.carbon_reduction_kg).toFixed(3)} kg CO₂
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}