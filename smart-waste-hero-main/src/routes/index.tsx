import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Leaf, Recycle, BarChart3, Trophy, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EcoSort AI — Smart Waste Sorting for Schools" },
      {
        name: "description",
        content:
          "AI-powered waste classification and sustainability intelligence for schools and communities.",
      },
      { property: "og:title", content: "EcoSort AI — Smart Waste Sorting" },
      {
        property: "og:description",
        content: "Classify waste with AI, earn points, and track your school's environmental impact.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground"
            style={{ background: "var(--gradient-ocean)" }}
          >
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">EcoSort AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-90"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 text-center text-primary-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> Built for schools, clubs & communities
          </span>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight md:text-6xl">
            Sort waste smarter.<br />
            <span className="text-secondary">Build a cleaner future.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-primary-foreground/85 md:text-lg">
            Snap a photo of any waste item. EcoSort AI classifies it, recommends disposal,
            estimates carbon savings, and rewards your school's sustainability journey.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" variant="secondary">
                Start scanning <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/10 text-primary-foreground hover:bg-white/20"
              >
                See dashboard
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-12 grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
        {[
          { icon: Camera, title: "AI classification", body: "Snap or upload an image — get instant category, confidence, and recyclability." },
          { icon: Recycle, title: "Disposal guidance", body: "Clear, actionable instructions reduce contamination in recycling streams." },
          { icon: BarChart3, title: "Impact analytics", body: "Carbon savings, recycling rates, and monthly trends across your school." },
          { icon: Trophy, title: "School leaderboard", body: "Rank schools by sustainability score, scans, and participation." },
          { icon: Sparkles, title: "Gamified learning", body: "Earn points and badges for every scan — keep students engaged." },
          { icon: Leaf, title: "Education built-in", body: "Each scan delivers a bite-sized environmental insight." },
        ].map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-lg"
          >
            <span
              className="grid h-10 w-10 place-items-center rounded-lg text-primary-foreground"
              style={{ background: "var(--gradient-ocean)" }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        EcoSort AI · Empowering schools to build a cleaner future.
      </footer>
    </div>
  );
}
