import { Link, useRouter } from "@tanstack/react-router";
import { Leaf, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminContext } from "@/lib/admin.functions";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/scan", label: "Scan" },
  { to: "/history", label: "History" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/achievements", label: "Achievements" },
] as const;

export function AppHeader() {
  const router = useRouter();
  const qc = useQueryClient();
  const ctxFn = useServerFn(getAdminContext);
  const ctxQ = useQuery({
    queryKey: ["admin-ctx"],
    queryFn: () => ctxFn(),
    staleTime: 60_000,
  });
  const isAdmin = !!ctxQ.data?.isAdmin;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-ocean)" }}
          >
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">EcoSort AI</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-2 text-sm text-foreground bg-muted" }}
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{
                className:
                  "flex items-center gap-1 rounded-md px-3 py-2 text-sm text-foreground bg-muted",
              }}
            >
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          )}
        </nav>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="mr-1 h-4 w-4" /> Sign out
        </Button>
      </div>
    </header>
  );
}