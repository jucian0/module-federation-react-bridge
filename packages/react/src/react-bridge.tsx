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
};

type RemoteAppInit = (
  mountPoint: HTMLElement,
  runtime?: RemoteRuntimeArgs,
) => () => void;

type LoaderArgs = {
  moduleLoader: Promise<{ default: RemoteAppInit }>;
  basename: string;
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
            initialPathname: stripBasename(location.pathname, basename),
          });
        }
      }

      loader();
    }, [moduleLoader, location.pathname, basename]);

    React.useEffect(() => unmountRef.current, []);

    React.useEffect(() => {
      const relativePathname = stripBasename(location.pathname, basename);
      const belongsToRemote =
        location.pathname === basename ||
        location.pathname.startsWith(`${basename}/`);

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
    }, [location.pathname, basename]);

    React.useEffect(() => {
      const remoteNavigationEventHandler = (event: NavigationEvent) => {
        if (event.detail.operation === "replace") {
          navigate(event.detail.pathname);
        }

        if (event.detail.pathname.includes("root")) {
          navigate(event.detail.pathname.replace("root", ""));
        }
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
};

export function NavigationManager(
  props: React.PropsWithChildren<RemoteAppProps>,
) {
  const { basename } = props;
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
    const pathnameWithoutBasename = pathname.split("/")[1];
    const isRemote = window.remotes[`/${pathnameWithoutBasename}`];

    window.dispatchEvent(
      new CustomEvent(`[${basename}] - navigated`, {
        detail: {
          pathname,
          basename,
          operation: isRemote ? "replace" : "push",
        },
      }),
    );
  }, [pathname, basename]);

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
          <NavigationManager basename={props.basename}>
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
