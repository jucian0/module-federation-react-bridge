type RemoteRegistry = Record<string, string>;

function getRemotes() {
  if (typeof window === "undefined") {
    return {};
  }

  return window.remotes ?? {};
}

export function normalizePathname(pathname: string) {
  if (!pathname) {
    return "/";
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function stripBasename(pathname: string, basename: string) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedBasename = normalizePathname(basename);

  if (normalizedPathname === normalizedBasename) {
    return "/";
  }

  if (normalizedPathname.startsWith(`${normalizedBasename}/`)) {
    return normalizedPathname.slice(normalizedBasename.length) || "/";
  }

  return normalizedPathname;
}

export function joinPaths(base: string, pathname: string) {
  const normalizedBase = normalizePathname(base);
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === "/") {
    return normalizedBase;
  }

  if (normalizedBase === "/") {
    return normalizedPathname;
  }

  return `${normalizedBase}${normalizedPathname}`;
}

export function resolveBrowserBasename(
  windowPathname: string,
  routerPathname: string,
) {
  const normalizedWindowPathname = normalizePathname(windowPathname);
  const normalizedRouterPathname = normalizePathname(routerPathname);

  if (normalizedRouterPathname === "/") {
    return normalizedWindowPathname === "/" ? "/" : normalizedWindowPathname;
  }

  if (normalizedWindowPathname === normalizedRouterPathname) {
    return "/";
  }

  if (normalizedWindowPathname.endsWith(normalizedRouterPathname)) {
    return (
      normalizedWindowPathname.slice(0, -normalizedRouterPathname.length) || "/"
    );
  }

  return "/";
}

function resolvePublicBasename(
  browserPathname: string,
  routerPathname: string,
  mountPath: string,
  remotes: RemoteRegistry,
) {
  const normalizedBrowserPathname = normalizePathname(browserPathname);
  const currentHostPathname = resolveHostNavigationPath(
    routerPathname,
    mountPath,
    remotes,
  );

  if (normalizedBrowserPathname === currentHostPathname) {
    return "/";
  }

  if (normalizedBrowserPathname.endsWith(currentHostPathname)) {
    return (
      normalizedBrowserPathname.slice(0, -currentHostPathname.length) || "/"
    );
  }

  return resolveBrowserBasename(browserPathname, routerPathname);
}

export function resolveHostNavigationPath(
  pathname: string,
  basename: string,
  remotes: RemoteRegistry = getRemotes(),
) {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedBasename = normalizePathname(basename);

  if (normalizedPathname === normalizedBasename) {
    return normalizedPathname;
  }

  if (normalizedPathname.startsWith(`${normalizedBasename}/`)) {
    return normalizedPathname;
  }

  if (normalizedPathname.startsWith("/root/")) {
    return normalizePathname(normalizedPathname.replace("/root", ""));
  }

  const firstSegment = normalizedPathname.split("/").filter(Boolean)[0];

  if (firstSegment && remotes[`/${firstSegment}`]) {
    return normalizedPathname;
  }

  return joinPaths(normalizedBasename, normalizedPathname);
}

type ResolveAnchorPublicHrefArgs = {
  href: string;
  origin: string;
  browserPathname: string;
  routerPathname: string;
  mountPath: string;
  remotes?: RemoteRegistry;
};

export function resolveAnchorPublicHref({
  href,
  origin,
  browserPathname,
  routerPathname,
  mountPath,
  remotes,
}: ResolveAnchorPublicHrefArgs) {
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return null;
  }

  const url = new URL(href, origin);
  const remoteRegistry = remotes ?? getRemotes();
  const browserBasename = resolvePublicBasename(
    browserPathname,
    routerPathname,
    mountPath,
    remoteRegistry,
  );

  if (
    url.origin !== origin ||
    (browserBasename !== "/" &&
      (url.pathname === browserBasename ||
        url.pathname.startsWith(`${browserBasename}/`)))
  ) {
    return null;
  }

  const publicPathname = joinPaths(
    browserBasename,
    resolveHostNavigationPath(url.pathname, mountPath, remoteRegistry),
  );

  return `${publicPathname}${url.search}${url.hash}`;
}
