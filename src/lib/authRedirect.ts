export type AuthAction = "confirm" | "recovery";

export function getAuthRedirectUrl(action: AuthAction = "confirm") {
  const basePath = import.meta.env.BASE_URL;
  const landingPath = basePath === "/" ? "/" : basePath;
  return `${window.location.origin}${landingPath}?auth_action=${action}`;
}

export function getAppRouteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return import.meta.env.BASE_URL === "/"
    ? `${window.location.origin}${normalizedPath}`
    : `${window.location.origin}${import.meta.env.BASE_URL}#${normalizedPath}`;
}
