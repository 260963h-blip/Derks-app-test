import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/microsoft/return")({
  component: OAuthReturn,
  head: () => ({
    meta: [
      { title: "Microsoft koppeling afronden" },
      { name: "description", content: "Microsoft-koppeling voor de planning wordt afgerond." },
      { property: "og:title", content: "Microsoft koppeling afronden" },
      { property: "og:description", content: "Microsoft-koppeling voor de planning wordt afgerond." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function OAuthReturn() {
  const [message, setMessage] = useState("Koppeling afronden…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed", code?: string) => {
      window.opener?.postMessage(
        { type, connectorId: "microsoft_excel", code: code ?? null },
        window.location.origin,
      );
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "De koppeling is niet voltooid.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("De koppeling gaf geen geldige code terug.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    notify("appUserConnectorOAuthComplete", code);
  }, []);

  return <p className="p-6 text-sm">{message}</p>;
}
