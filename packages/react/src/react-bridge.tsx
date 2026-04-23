import React from "react";
import ReactDOM from "react-dom/client";
import {
  useLocation,
  useNavigate,
  type RouteObject,
  createBrowserRouter,
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";

declare global {
  interface Window {
    remotes: Record<string, string>;
  }
}

window.remotes = window.remotes || {};

export type NavigationDetails = {
  pathname: string;
  basename: string;
  operation: "push" | "replace";
};

export type NavigationEvent = CustomEvent<NavigationDetails>;

export type RemoteRuntimeArgs = {
  initialPathname?: string;
  mountPath?: string;
};

type RemoteAppInit = (
  mountPoint: HTMLElement,
  runtime?: RemoteRuntimeArgs,
) => () => void;

type LoaderArgs = {
  moduleLoader: Promise<{ default: RemoteAppInit }>;
  basename: string;
  mountPath?: string;
};

function normalizePathname(pathname: string) {
  if (!pathname) {
    return "/";
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function stripBasename(pathname: string, basename: string) {
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

function joinPaths(base: string, pathname: string) {
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

function resolveBrowserBasename(
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

function resolveHostNavigationPath(pathname: string, basename: string) {
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

  if (firstSegment && window.remotes[`/${firstSegment}`]) {
    return normalizedPathname;
  }

  return joinPaths(normalizedBasename, normalizedPathname);
}

export function loadRemoteApp(args: LoaderArgs) {
  if (!window.remotes) {
    window.remotes = {};
  }

  window.remotes[args.basename] = args.basename;

  return () => {
    const mountPoint = React.useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { moduleLoader, basename } = args;
    const mountPath = args.mountPath ?? basename;

    const isFirstRunRef = React.useRef(true);
    const unmountRef = React.useRef(() => {});

    React.useEffect(() => {
      async function loader() {
        if (mountPoint.current) {
          if (!isFirstRunRef.current) {
            return;
          }

          isFirstRunRef.current = false;

          const { default: remoteInit } = await moduleLoader;
          unmountRef.current = remoteInit(mountPoint.current, {
            initialPathname: stripBasename(location.pathname, mountPath),
            mountPath,
          });
        }
      }

      loader();
    }, [moduleLoader, location.pathname, basename, mountPath]);

    React.useEffect(() => unmountRef.current, []);

    React.useEffect(() => {
      const relativePathname = stripBasename(location.pathname, mountPath);
      const belongsToRemote =
        location.pathname === mountPath ||
        location.pathname.startsWith(`${mountPath}/`);

      if (belongsToRemote && mountPoint.current) {
        window.dispatchEvent(
          new CustomEvent<NavigationDetails>("[Navigation] - navigated", {
            detail: {
              pathname: relativePathname,
              basename,
              operation: "push",
            },
          }),
        );
      }
    }, [location.pathname, basename, mountPath]);

    React.useEffect(() => {
      if (!mountPoint.current) {
        return;
      }

      const browserBasename = resolveBrowserBasename(
        window.location.pathname,
        location.pathname,
      );
      const remoteRoot = mountPoint.current;

      const syncAnchorHrefs = () => {
        const anchors = remoteRoot.querySelectorAll<HTMLAnchorElement>("a[href]");

        anchors.forEach((anchor) => {
          const href = anchor.getAttribute("href");

          if (
            !href ||
            href.startsWith("#") ||
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
          ) {
            return;
          }

          const url = new URL(href, window.location.origin);

          if (
            url.origin !== window.location.origin ||
            (browserBasename !== "/" &&
              (url.pathname === browserBasename ||
                url.pathname.startsWith(`${browserBasename}/`)))
          ) {
            return;
          }

          const publicPathname = joinPaths(
            browserBasename,
            resolveHostNavigationPath(url.pathname, mountPath),
          );
          const resolvedHref = `${publicPathname}${url.search}${url.hash}`;

          if (href !== resolvedHref) {
            anchor.setAttribute("href", resolvedHref);
          }
        });
      };

      syncAnchorHrefs();

      const observer = new MutationObserver(syncAnchorHrefs);
      observer.observe(remoteRoot, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["href"],
      });

      return () => {
        observer.disconnect();
      };
    }, [location.pathname, mountPath]);

    React.useEffect(() => {
      const remoteNavigationEventHandler = (event: NavigationEvent) => {
        if (event.detail.operation === "replace") {
          navigate(event.detail.pathname, { replace: true });
          return;
        }

        navigate(event.detail.pathname);
      };

      window.addEventListener(
        `[${basename}] - navigated`,
        remoteNavigationEventHandler as EventListener,
      );

      return () => {
        window.removeEventListener(
          `[${basename}] - navigated`,
          remoteNavigationEventHandler as EventListener,
        );
      };
    }, [basename, navigate]);

    return <div ref={mountPoint} id={basename} />;
  };
}

type RemoteAppProps = {
  basename: string;
  mountPath?: string;
};

export function NavigationManager(
  props: React.PropsWithChildren<RemoteAppProps>,
) {
  const { basename } = props;
  const mountPath = props.mountPath ?? basename;
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  React.useEffect(() => {
    function eventListener(event: NavigationEvent) {
      const eventPathname = event.detail.pathname;

      if (pathname !== eventPathname && event.detail.basename === basename) {
        navigate(eventPathname);
      }
    }

    window.addEventListener(
      "[Navigation] - navigated",
      eventListener as EventListener,
    );

    return () => {
      window.removeEventListener(
        "[Navigation] - navigated",
        eventListener as EventListener,
      );
    };
  }, [pathname, basename, navigate]);

  React.useEffect(() => {
    const hostPathname = resolveHostNavigationPath(pathname, mountPath);
    const firstSegment = hostPathname.split("/").filter(Boolean)[0];
    const isAnotherRemote =
      Boolean(firstSegment) &&
      firstSegment !== mountPath.replace("/", "").split("/").pop() &&
      Boolean(window.remotes[`/${firstSegment}`]);

    window.dispatchEvent(
      new CustomEvent(`[${basename}] - navigated`, {
        detail: {
          pathname: hostPathname,
          basename,
          operation: isAnotherRemote ? "replace" : "push",
        },
      }),
    );
  }, [pathname, basename, mountPath]);

  return <>{props.children}</>;
}

export function createRemoteApp(props: {
  routes: RouteObject[];
  basename: string;
  RootComponent: React.ComponentType<React.PropsWithChildren<{}>>;
}) {
  return (mountPoint: HTMLElement, runtime?: RemoteRuntimeArgs) => {
    const routes = [
      {
        path: "/",
        element: (
          <NavigationManager
            basename={props.basename}
            mountPath={runtime?.mountPath}
          >
            <props.RootComponent />
          </NavigationManager>
        ),
        children: props.routes,
      },
    ];

    const router = runtime?.initialPathname
      ? createMemoryRouter(routes, {
          initialEntries: [normalizePathname(runtime.initialPathname)],
        })
      : createBrowserRouter(routes, {
          basename: props.basename,
        });

    const root = ReactDOM.createRoot(mountPoint);
    root.render(<RouterProvider router={router} />);
    return () => root.unmount();
  };
}
