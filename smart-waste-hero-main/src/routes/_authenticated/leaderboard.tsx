import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard } from "@/lib/waste.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Download } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — EcoSort AI" }] }),
  component: LeaderboardPage,
});

const MEDAL = ["🥇", "🥈", "🥉"];

function csvCell(v: string) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function LeaderboardPage() {
  const fn = useServerFn(getLeaderboard);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const payload = useMemo(() => {
    const data: { from?: string; to?: string } = {};
    if (from) data.from = new Date(from + "T00:00:00").toISOString();
    if (to) data.to = new Date(to + "T23:59:59").toISOString();
    return data;
  }, [from, to]);

  const q = useQuery({
    queryKey: ["leaderboard", payload],
    queryFn: () => fn({ data: payload }),
  });

  function exportCsv() {
    const rows = q.data ?? [];
    const header = ["Rank", "School", "Location", "Points", "Scans", "CO2_kg", "Sustainability"];
    const csv = [header.join(",")]
      .concat(
        rows.map((s, i) =>
          [
            i + 1,
            csvCell(s.name),
            csvCell(s.location ?? ""),
            s.points,
            s.scans,
            s.carbon,
            s.sustainability,
          ].join(","),
        ),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const tag = [from || "all", to || "all"].join("_to_");
    a.href = url;
    a.download = `leaderboard_${tag}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School leaderboard</h1>
          <p className="text-muted-foreground">Ranked by eco points earned across all scans.</p>
        </div>
      </div>

      <Card className="mt-6">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>Reset</Button>
          <div className="ml-auto">
            <Button onClick={exportCsv} disabled={!q.data?.length}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" /> Top schools
          </CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !q.data?.length ? (
            <p className="text-sm text-muted-foreground">No schools yet.</p>
          ) : (
            <ol className="divide-y divide-border">
              {q.data.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-lg font-semibold">
                      {MEDAL[i] ?? i + 1}
                    </span>
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.location ?? "—"}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{s.points} pts</p>
                    <p className="text-xs text-muted-foreground">
                      {s.scans} scans · {s.carbon.toFixed(2)} kg CO₂
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </main>
  );
}