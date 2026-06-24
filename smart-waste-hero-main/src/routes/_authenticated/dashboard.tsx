import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyStats, listSchools, setMySchool } from "@/lib/waste.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Leaf, Recycle, Sparkles } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — EcoSort AI" }] }),
  component: Dashboard,
});

const COLORS = ["#06b6d4", "#0c4a6e", "#14b8a6", "#84cc16", "#f59e0b", "#a855f7", "#ef4444", "#64748b"];

function Dashboard() {
  const fetchStats = useServerFn(getMyStats);
  const fetchSchools = useServerFn(listSchools);
  const updateSchool = useServerFn(setMySchool);

  const stats = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });
  const schools = useQuery({ queryKey: ["schools"], queryFn: () => fetchSchools() });

  const pieData = Object.entries(stats.data?.categoryCounts ?? {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Hi {stats.data?.profile?.full_name ?? "there"} 👋
          </h1>
          <p className="text-muted-foreground">Your sustainability snapshot.</p>
        </div>
        <Link to="/scan">
          <Button size="lg">
            <Camera className="mr-2 h-4 w-4" /> New scan
          </Button>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total scans" value={stats.data?.totalScans ?? 0} icon={<Recycle className="h-5 w-5" />} />
        <StatCard label="Eco points" value={stats.data?.points ?? 0} icon={<Sparkles className="h-5 w-5" />} />
        <StatCard
          label="CO₂ saved (kg)"
          value={(stats.data?.carbonSavedKg ?? 0).toFixed(2)}
          icon={<Leaf className="h-5 w-5" />}
        />
        <StatCard label="Recycling rate" value={`${stats.data?.recyclingRate ?? 0}%`} icon={<Recycle className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly scan trend</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.data?.monthly ?? []}>
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Waste categories</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {pieData.length === 0 ? (
              <p className="grid h-full place-items-center text-sm text-muted-foreground">
                No scans yet. Run your first scan to see your breakdown.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Your school</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select
            value={stats.data?.profile?.school_id ?? undefined}
            onValueChange={async (v) => {
              try {
                await updateSchool({ data: { schoolId: v } });
                toast.success("School updated");
                stats.refetch();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Update failed");
              }
            }}
          >
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a school" />
            </SelectTrigger>
            <SelectContent>
              {(schools.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">Your scans contribute to your school's sustainability score.</p>
        </CardContent>
      </Card>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <span
          className="grid h-10 w-10 place-items-center rounded-xl text-primary-foreground"
          style={{ background: "var(--gradient-ocean)" }}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}