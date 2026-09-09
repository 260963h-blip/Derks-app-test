import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

type TokenInput = { accessToken: string };

const tokenOnly = (input: unknown): TokenInput => ({
  accessToken: String((input as any)?.accessToken ?? ""),
});

export const startMicrosoftConnect = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/require-user.server");
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { getConnectionKeyForUser } = await import("@/lib/app-user-connections.server");
    const { GATEWAY_BASE_URL, CONNECTOR_ID, MICROSOFT_SCOPES } = await import("@/lib/planning-sync.server");

    const userId = await requireUserId(data.accessToken);
    const clientKey = process.env['MICROSOFT_EXCEL_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientKey) throw new Error("De Microsoft-koppeling is nog niet ingesteld.");

    const request = getRequest();
    if (!request) throw new Error("OAuth moet vanuit de app gestart worden.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/microsoft/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const existing = await getConnectionKeyForUser(userId, CONNECTOR_ID);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: {
        scopes: MICROSOFT_SCOPES,
        prompt: "select_account",
      },
    });
    return { authorizationUrl };
  });

export const completeMicrosoftConnection = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ({
    accessToken: String((input as any)?.accessToken ?? ""),
    code: String((input as any)?.code ?? ""),
  }))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/require-user.server");
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("@/lib/app-user-connections.server");
    const { GATEWAY_BASE_URL, CONNECTOR_ID } = await import("@/lib/planning-sync.server");

    const userId = await requireUserId(data.accessToken);
    if (!data.code) throw new Error("Geen koppelcode ontvangen.");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
    if (connectorId !== CONNECTOR_ID) throw new Error("Verkeerde koppeling ontvangen.");
    await saveConnectionKeyForUser(userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const microsoftStatus = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/require-user.server");
    const { getConnectionKeyForUser } = await import("@/lib/app-user-connections.server");
    const { CONNECTOR_ID } = await import("@/lib/planning-sync.server");
    const userId = await requireUserId(data.accessToken);
    const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
    return { connected: Boolean(key) };
  });

export const disconnectMicrosoft = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/require-user.server");
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import("@/lib/app-user-connections.server");
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, CONNECTOR_ID } = await import("@/lib/planning-sync.server");
    const userId = await requireUserId(data.accessToken);
    const key = await getConnectionKeyForUser(userId, CONNECTOR_ID);
    if (key) {
      await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: key, connectorId: CONNECTOR_ID })
        .catch(() => undefined);
      await deleteConnectionForUser(userId, CONNECTOR_ID);
    }
    return { ok: true };
  });

export const listPlanningFiles = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/require-user.server");
    const { listExcelFiles } = await import("@/lib/planning-sync.server");
    const userId = await requireUserId(data.accessToken);
    return { files: await listExcelFiles(userId) };
  });

export const listPlanningWorksheets = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ({
    accessToken: String((input as any)?.accessToken ?? ""),
    fileId: String((input as any)?.fileId ?? ""),
  }))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/require-user.server");
    const { listWorksheets } = await import("@/lib/planning-sync.server");
    const userId = await requireUserId(data.accessToken);
    return { sheets: await listWorksheets(userId, data.fileId) };
  });

export const runPlanningSync = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const { requireUserId } = await import("@/lib/require-user.server");
    const { syncPlanningForUser } = await import("@/lib/planning-sync.server");
    const userId = await requireUserId(data.accessToken);
    return await syncPlanningForUser(userId);
  });
