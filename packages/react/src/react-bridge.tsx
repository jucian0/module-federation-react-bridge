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

type RemoteRuntimeArgs = {
  initialPathname?: string;
};

type LoaderArgs = {
  moduleLoader: Promise<{
    default: (
      mountPoint: HTMLElement,
      runtime?: RemoteRuntimeArgs,
    ) => () => void;
  }>;
  basename: string;
};

function normalizePath(pathname: string) {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function stripBasename(pathname: string, basename: string) {
  const normalizedPathname = normalizePath(pathname);
  const normalizedBasename = normalizePath(basename);

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

  return function RemoteAppLoader() {
    const mountPoint = React.useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { moduleLoader, basename } = args;

    const isFirstRunRef = React.useRef(true);
    const unmountRef = React.useRef(() => {});

    React.useEffect(() => {
      async function loader() {
        if (!mountPoint.current || !isFirstRunRef.current) {
          return;
        }

        isFirstRunRef.current = false;

        const { default: remoteInit } = await moduleLoader;
        unmountRef.current = remoteInit(mountPoint.current, {
          initialPathname: stripBasename(location.pathname, basename),
        });
      }

      loader();
    }, [moduleLoader, location.pathname, basename]);

    React.useEffect(() => unmountRef.current, []);

    React.useEffect(() => {
      if (!mountPoint.current) {
        return;
      }

      const relativePathname = stripBasename(location.pathname, basename);

      if (relativePathname !== location.pathname || location.pathname === basename) {
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
      const eventPathname = normalizePath(event.detail.pathname);

      if (event.detail.basename === basename && pathname !== eventPathname) {
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
    const firstSegment = pathname.split("/").filter(Boolean)[0];
    const isAnotherRemote = Boolean(firstSegment && window.remotes[`/${firstSegment}`]);

    window.dispatchEvent(
      new CustomEvent<NavigationDetails>(`[${basename}] - navigated`, {
        detail: {
          pathname,
          basename,
          operation: isAnotherRemote ? "replace" : "push",
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
    const routes: RouteObject[] = [
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
          initialEntries: [normalizePath(runtime.initialPathname)],
        })
      : createBrowserRouter(routes, {
          basename: props.basename,
        });

    const root = ReactDOM.createRoot(mountPoint);
    root.render(<RouterProvider router={router} />);

    return () => root.unmount();
  };
}
