import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import logo from "@/assets/logo-derks.png";

export function AppShell({
  title,
  subtitle,
  back,
  backTo,
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  backTo?: string;
  children: ReactNode;
}) {
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
          <Link to="/" className="flex items-center gap-3">
            <img src={logo} alt="Derks" className="h-10 w-auto" />
            <div>
              <h1 className="text-lg font-semibold leading-tight">Stucadoorsbedrijf Derks</h1>
              <p className="text-xs text-muted-foreground">Offertes & Facturen</p>
            </div>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Uitloggen
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          {back && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (backTo) {
                  navigate({ to: backTo });
                } else if (typeof window !== "undefined" && window.history.length > 1) {
                  window.history.back();
                } else {
                  navigate({ to: "/" });
                }
              }}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Terug
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}