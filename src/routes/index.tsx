import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, Users, Package, UserCog, Building2, LogOut, Clock, CalendarDays, Settings, FolderKanban } from "lucide-react";
import logo from "@/assets/logo-derks.png";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const menu: Array<{
  title: string;
  desc: string;
  icon: typeof FileText;
  to?: string;
}> = [
  { title: "Projecten", desc: "Projecten met offerte, werkorder en factuur", icon: FolderKanban, to: "/projecten" },
  { title: "Offertes (oud)", desc: "Bestaande offertenlijst", icon: FileText, to: "/offertes" },
  { title: "Facturen", desc: "Facturen en UBL/XML-export", icon: Receipt },
  { title: "Klanten", desc: "Klantgegevens beheren", icon: Users, to: "/klanten" },
  { title: "Artikelen", desc: "Materialen en werkzaamheden", icon: Package, to: "/artikelen" },
  { title: "Medewerkers", desc: "HR-dossier en personeelsgegevens", icon: UserCog, to: "/medewerkers" },
  { title: "Urenregistratie", desc: "Gewerkte uren per medewerker", icon: Clock, to: "/uren" },
  { title: "Verlof", desc: "Vakantie, ziekte en bijzonder verlof", icon: CalendarDays, to: "/verlof" },
  { title: "Bedrijfsgegevens", desc: "Eigen bedrijfsinformatie", icon: Building2, to: "/bedrijfsgegevens" },
  { title: "Instellingen", desc: "Categorieën en eenheden beheren", icon: Settings, to: "/instellingen" },
];

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Derks" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-semibold leading-tight">Stucadoorsbedrijf Derks</h1>
              <p className="text-xs text-muted-foreground">Offertes & Facturen</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Uitloggen
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Welkom terug</h2>
          <p className="text-muted-foreground">Ingelogd als {user.email}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menu.map((item) => {
            const Icon = item.icon;
            const inner = (
              <Card
                className={
                  item.to
                    ? "cursor-pointer transition-colors hover:bg-accent/50"
                    : "cursor-not-allowed opacity-70"
                }
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-secondary p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                  {!item.to && (
                    <p className="mt-2 text-xs italic text-muted-foreground">Binnenkort beschikbaar</p>
                  )}
                </CardContent>
              </Card>
            );
            return item.to ? (
              <Link key={item.title} to={item.to}>
                {inner}
              </Link>
            ) : (
              <div key={item.title}>{inner}</div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
