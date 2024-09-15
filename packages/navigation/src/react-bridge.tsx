import React from "react";
import { useLocation, useNavigate, Link, type LinkProps, type RouteObject, createBrowserRouter, RouterProvider } from "react-router-dom";

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
  RemoteApp: React.LazyExoticComponent<React.ComponentType<any>>;
  basename: string;
}

export function loadRemoteApp<T = unknown>(args: LoaderArgs) {
  /**
   * Store in memory the basename of the remote app
   */
  if (!window.remotes) {
    window.remotes = {};
  }
  window.remotes[args.basename] = args.basename;

  return (props: T = {} as T) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { RemoteApp, basename } = args;

    /**
     * Dispatch navigation events from the host app to the remote app
     */
    React.useEffect(() => {
      if (location.pathname.startsWith(basename)) {
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
    }, [location, basename]);

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
      <React.Suspense fallback={<div>Loading...</div>}>
        <RemoteApp {...props} />
      </React.Suspense>
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
      if (pathname !== eventPathname) {
        navigate(event.detail.pathname);
      }
    }
    window.addEventListener('[Navigation] - navigated', eventListener as EventListener);
    return () => {
      window.removeEventListener('[Navigation] - navigated', eventListener as EventListener);
    };
  }, [pathname, navigate]);

  /**
   * Dispatch navigation events from the remote app to the host app just in case the route belongs to the host app or other remotes
   */
  React.useEffect(() => {
    const pathnameWithoutBasename = pathname.split('/')[1];
    window.dispatchEvent(
      new CustomEvent(`[${basename}] - navigated`, {
        detail: {
          pathname: pathname,
          basename: basename,
          operation: window.remotes[`/${pathnameWithoutBasename}`] ? "replace" : "push"
        },
      })
    );

  }, [pathname, basename])

  return (
    <>{props.children}</>
  )
}


export function LinkCrossApp(props: LinkProps) {
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(props.to);
  }
  return <Link {...props} onClick={handleClick} />
}





export function createRemoteApp(props: {
  routes: RouteObject[];
  basename: string;
  RootComponent: React.ComponentType<React.PropsWithChildren<{}>>;
}) {

  const router = createBrowserRouter([
    {
      path: "",
      element: <NavigationManager basename={props.basename}><props.RootComponent /></NavigationManager>,
      children: props.routes,
    }
  ], {
    basename: props.basename,
  })

  return () => {
    return <RouterProvider router={router} />
  }
}