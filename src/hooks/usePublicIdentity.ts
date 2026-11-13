import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { assetUrl } from "@/lib/assets";

export interface PublicOrgIdentity {
  id?: string;
  name: string;
  logo_url: string;
  cover_url: string;
  primary_color: string;
  social_links: Record<string, string>;
}

const DEFAULT_IDENTITY: PublicOrgIdentity = {
  name: "Proyecto Orquesta",
  logo_url: "/assets/proyecto-orquesta-logo.png",
  cover_url: "/assets/orquesta-stage-hero.png",
  primary_color: "#5B21F4",
  social_links: {},
};

const listeners = new Set<() => void>();

export function notifyPublicIdentityUpdated() {
  listeners.forEach((fn) => fn());
}

export function usePublicIdentity() {
  const [identity, setIdentity] = useState<PublicOrgIdentity>(DEFAULT_IDENTITY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.rpc("get_public_organization_identity");
      if (data && typeof data === "object") {
        const raw = data as Record<string, unknown>;
        const social = (raw.social_links && typeof raw.social_links === "object"
          ? raw.social_links
          : {}) as Record<string, string>;
        const rawLogo = typeof raw.logo_url === "string" && raw.logo_url.trim()
          ? raw.logo_url.trim()
          : DEFAULT_IDENTITY.logo_url;
        const rawCover = (typeof raw.cover_url === "string" && raw.cover_url.trim()
          ? raw.cover_url.trim()
          : social.cover_url?.trim()) || DEFAULT_IDENTITY.cover_url;
        setIdentity({
          id: typeof raw.id === "string" ? raw.id : undefined,
          name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : DEFAULT_IDENTITY.name,
          logo_url: assetUrl(rawLogo),
          cover_url: assetUrl(rawCover),
          primary_color: typeof raw.primary_color === "string" && raw.primary_color.trim()
            ? raw.primary_color.trim()
            : DEFAULT_IDENTITY.primary_color,
          social_links: social,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const handler = () => { void load(); };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, [load]);

  return { identity, loading, refresh: load };
}
