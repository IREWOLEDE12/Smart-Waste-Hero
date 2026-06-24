import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getAdminContext,
  claimFirstAdmin,
  adminListSchools,
  adminCreateSchool,
  adminUpdateSchool,
  adminDeleteSchool,
  adminListUsers,
  adminSetUserRole,
  adminAssignSchool,
} from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — EcoSort AI" }] }),
  component: AdminPage,
});

const ROLES = ["admin", "coordinator", "teacher", "student"] as const;

function AdminPage() {
  const ctxFn = useServerFn(getAdminContext);
  const claim = useServerFn(claimFirstAdmin);
  const qc = useQueryClient();
  const ctxQ = useQuery({ queryKey: ["admin-ctx"], queryFn: () => ctxFn() });

  const claimM = useMutation({
    mutationFn: () => claim(),
    onSuccess: () => {
      toast.success("You are now an admin");
      qc.invalidateQueries({ queryKey: ["admin-ctx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ctxQ.isLoading) {
    return <main className="mx-auto max-w-6xl px-4 py-8 text-muted-foreground">Loading…</main>;
  }

  if (!ctxQ.data?.isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Admin access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ctxQ.data?.adminCount === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  No admin exists yet. Claim the first admin role to manage schools, users, and
                  the leaderboard.
                </p>
                <Button onClick={() => claimM.mutate()} disabled={claimM.isPending}>
                  {claimM.isPending ? "Claiming…" : "Become first admin"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                You don't have admin permissions. Ask an existing admin to grant you the admin
                role.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Admin panel</h1>
      </div>
      <p className="text-muted-foreground">
        Manage schools, user roles, and leaderboard visibility.
      </p>

      <Tabs defaultValue="schools" className="mt-6">
        <TabsList>
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
        </TabsList>
        <TabsContent value="schools" className="mt-4">
          <SchoolsPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersPanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function SchoolsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListSchools);
  const createFn = useServerFn(adminCreateSchool);
  const updateFn = useServerFn(adminUpdateSchool);
  const deleteFn = useServerFn(adminDeleteSchool);

  const q = useQuery({ queryKey: ["admin-schools"], queryFn: () => listFn() });

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const create = useMutation({
    mutationFn: (v: { name: string; location: string }) =>
      createFn({ data: { name: v.name, location: v.location || null } }),
    onSuccess: () => {
      toast.success("School added");
      setName("");
      setLocation("");
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; is_visible?: boolean; name?: string; location?: string | null }) =>
      updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("School deleted");
      qc.invalidateQueries({ queryKey: ["admin-schools"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Add school</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Button
            onClick={() => create.mutate({ name, location })}
            disabled={!name.trim() || create.isPending}
            className="w-full"
          >
            <Plus className="mr-1 h-4 w-4" /> Add school
          </Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Schools ({q.data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !q.data?.length ? (
            <p className="text-sm text-muted-foreground">No schools yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {q.data.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.location ?? "—"} · {s.scans} scans · {s.points} pts
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={s.is_visible}
                        onCheckedChange={(v) =>
                          update.mutate({ id: s.id, is_visible: v })
                        }
                      />
                      Leaderboard
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete "${s.name}"? Scans will keep their reference but lose the school link.`)) {
                          del.mutate(s.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListUsers);
  const schoolsFn = useServerFn(adminListSchools);
  const roleFn = useServerFn(adminSetUserRole);
  const assignFn = useServerFn(adminAssignSchool);

  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => listFn() });
  const schools = useQuery({ queryKey: ["admin-schools"], queryFn: () => schoolsFn() });

  const setRole = useMutation({
    mutationFn: (v: { userId: string; role: (typeof ROLES)[number]; action: "add" | "remove" }) =>
      roleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-ctx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: (v: { userId: string; schoolId: string | null }) => assignFn({ data: v }),
    onSuccess: () => {
      toast.success("School assigned");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Users ({users.data?.length ?? 0})</CardTitle>
      </CardHeader>
      <CardContent>
        {users.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !users.data?.length ? (
          <p className="text-sm text-muted-foreground">No users.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">User</th>
                  <th className="py-2">Points</th>
                  <th className="py-2">School</th>
                  <th className="py-2">Roles</th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className="border-b align-top">
                    <td className="py-3">
                      <p className="font-medium">{u.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="py-3">{u.points}</td>
                    <td className="py-3 w-56">
                      <Select
                        value={u.school_id ?? "none"}
                        onValueChange={(v) =>
                          assign.mutate({ userId: u.id, schoolId: v === "none" ? null : v })
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="No school" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No school</SelectItem>
                          {(schools.data ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {ROLES.map((r) => {
                          const has = u.roles.includes(r);
                          return (
                            <Badge
                              key={r}
                              variant={has ? "default" : "outline"}
                              className="cursor-pointer select-none"
                              onClick={() =>
                                setRole.mutate({
                                  userId: u.id,
                                  role: r,
                                  action: has ? "remove" : "add",
                                })
                              }
                            >
                              {r}
                            </Badge>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}