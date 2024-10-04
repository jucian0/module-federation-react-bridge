import React from "react";
import ReactDOM from "react-dom/client";
import { useLocation, useNavigate, type RouteObject, createBrowserRouter, RouterProvider } from "react-router-dom";

declare global {
  interface Window { remotes: Record<string, string> }
}

window.remotes = window.remotes || {};

export type NavigationDetails = {
  pathname: string;
  basename: string;
  operation: "push" | "replace";
};

export type NavigationEvent = CustomEvent<NavigationDetails>;

type LoaderArgs = {
  moduleLoader: Promise<{ default: (mountPoint: HTMLElement) => () => void }>;
  basename: string;
}

export function loadRemoteApp(args: LoaderArgs) {
  /**
   * Store in memory the basename of the remote app
   */
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
    const unmountRef = React.useRef(() => { });

    React.useEffect(() => {
      async function loader() {
        if (mountPoint.current) {
          if (!isFirstRunRef.current) {
            return;
          }
          isFirstRunRef.current = false;
          const { default: remoteInit } = await moduleLoader
          unmountRef.current = remoteInit(mountPoint.current)
        }
      }
      loader();
    }, [moduleLoader]);

    React.useEffect(() => unmountRef.current, []);


    /**
     * Dispatch navigation events from the host app to the remote app
     */
    React.useEffect(() => {
      if (location.pathname.startsWith(basename) && mountPoint.current) {
        window.dispatchEvent(
          new CustomEvent<NavigationDetails>('[Navigation] - navigated', {
            detail: {
              pathname: location.pathname.replace(basename, ""),
              basename: basename,
              operation: "push"
            },
          })
        );
      }
    }, [location, basename]); // Removed unnecessary dependencies

    /**
     * Listen to navigation events from the remote app
     */
    React.useEffect(() => {
      const remoteNavigationEventHandler = (event: NavigationEvent) => {
        if (event.detail.operation === "replace") {
          navigate(event.detail.pathname);
        };
        if (event.detail.pathname.includes('root')) {
          navigate(event.detail.pathname.replace('root', ''));
        }
      }
      window.addEventListener(`[${basename}] - navigated`, remoteNavigationEventHandler as EventListener);
      return () => {
        window.removeEventListener(`[${basename}] - navigated`, remoteNavigationEventHandler as EventListener);
      };
    }, [basename, navigate]);

    return (
      <div ref={mountPoint} id={basename} />
    )
  }
}

type RemoteAppProps = {
  basename: string;
}

export function NavigationManager(props: React.PropsWithChildren<RemoteAppProps>) {
  const { basename } = props;
  const navigate = useNavigate();
  const pathname = useLocation().pathname;

  /**
   * Listen to navigation events from the host app
   */
  React.useEffect(() => {
    function eventListener(event: NavigationEvent) {
      const eventPathname = event.detail.pathname
      if (pathname !== eventPathname && event.detail.basename === basename) {
        navigate(eventPathname);
      }
    }
    window.addEventListener('[Navigation] - navigated', eventListener as EventListener);
    return () => {
      window.removeEventListener('[Navigation] - navigated', eventListener as EventListener);
    };
  }, [pathname, basename, navigate]);

  /**
   * Dispatch navigation events from the remote app to the host app just in case the route belongs to the host app or other remotes
   */
  React.useEffect(() => {
    const pathnameWithoutBasename = pathname.split('/')[1];
    const isRemote = window.remotes[`/${pathnameWithoutBasename}`];
    window.dispatchEvent(
      new CustomEvent(`[${basename}] - navigated`, {
        detail: {
          pathname: pathname,
          basename: basename,
          operation: isRemote ? "replace" : "push"
        },
      })
    );

  }, [pathname, basename])

  return (
    <>{props.children}</>
  )
}

export function createRemoteApp(props: {
  routes: RouteObject[];
  basename: string;
  RootComponent: React.ComponentType<React.PropsWithChildren<{}>>;
}) {


  return (mountPoint: HTMLElement) => {
    const router = createBrowserRouter([
      {
        path: "/",
        element: <NavigationManager basename={props.basename}><props.RootComponent /></NavigationManager>,
        children: props.routes,
      }
    ], {
      basename: props.basename,
    })
    const root = ReactDOM.createRoot(mountPoint);
    root.render(<RouterProvider router={router} />);
    return () => root.unmount();
  }
}