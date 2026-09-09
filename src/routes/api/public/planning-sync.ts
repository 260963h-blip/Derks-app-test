import { createFileRoute } from "@tanstack/react-router";

async function handle() {
  const { listUsersWithConnection } = await import("@/lib/app-user-connections.server");
  const { syncPlanningForUser, CONNECTOR_ID } = await import("@/lib/planning-sync.server");
  const users = await listUsersWithConnection(CONNECTOR_ID);
  const results: Record<string, unknown> = {};
  for (const userId of users) {
    try {
      results[userId] = await syncPlanningForUser(userId);
    } catch (e) {
      results[userId] = { error: e instanceof Error ? e.message : "onbekende fout" };
    }
  }
  return new Response(JSON.stringify({ ok: true, users: users.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
}

function authorized(request: Request): boolean {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const syncSecret = process.env['PLANNING_SYNC_SECRET'];
  if (serviceKey && bearer && bearer === serviceKey) return true;
  if (syncSecret && request.headers.get("x-planning-sync-secret") === syncSecret) return true;
  return false;
}

export const Route = createFileRoute("/api/public/planning-sync")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
        return handle();
      },
    },
  },
});
