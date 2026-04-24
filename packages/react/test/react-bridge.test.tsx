import React from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, describe, expect, test } from "@rstest/core";
import {
  createRemoteApp,
  loadRemoteApp,
  type NavigationDetails,
} from "../src/react-bridge";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function createContainer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return container;
}

async function flushEffects() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function render(ui: React.ReactNode) {
  const container = createContainer();
  const root = createRoot(container);

  await act(async () => {
    root.render(ui);
    await flushEffects();
  });

  return { container, root };
}

async function unmount(root: Root) {
  await act(async () => {
    root.unmount();
    await flushEffects();
  });
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
  window.remotes = {};
});

describe("loadRemoteApp", () => {
  test("mounts the remote with the stripped initial pathname", async () => {
    window.history.replaceState({}, "", "/root/host/remote/tokens");

    const remoteCalls: Array<{
      runtime: { initialPathname?: string; mountPath?: string } | undefined;
    }> = [];
    const RemoteApp = loadRemoteApp({
      basename: "/remote",
      moduleLoader: Promise.resolve({
        default: (_mountPoint, runtime) => {
          remoteCalls.push({ runtime });
          return () => {};
        },
      }),
    });

    const { root } = await render(
      <MemoryRouter initialEntries={["/remote/tokens"]}>
        <RemoteApp />
      </MemoryRouter>,
    );

    expect(remoteCalls).toHaveLength(1);
    expect(remoteCalls[0]?.runtime).toEqual({
      initialPathname: "/tokens",
      mountPath: "/remote",
    });

    await unmount(root);
  });

  test("rewrites remote anchors to public paths that keep host and remote basenames", async () => {
    window.history.replaceState({}, "", "/root/host/remote/apps");
    window.remotes = { "/cart": "/cart", "/remote": "/remote" };

    const RemoteApp = loadRemoteApp({
      basename: "/remote",
      moduleLoader: Promise.resolve({
        default: (mountPoint) => {
          mountPoint.innerHTML = '<a href="/cart/item">Cart item</a>';
          return () => {};
        },
      }),
    });

    const { container, root } = await render(
      <MemoryRouter initialEntries={["/remote/apps"]}>
        <RemoteApp />
      </MemoryRouter>,
    );

    await act(async () => {
      await flushEffects();
    });

    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/root/host/cart/item");

    await unmount(root);
  });

  test("navigates when the host dispatches a matching remote navigation event", async () => {
    window.history.replaceState({}, "", "/root/host/remote/apps");

    const remoteCalls: string[] = [];
    const RemoteApp = loadRemoteApp({
      basename: "/remote",
      moduleLoader: Promise.resolve({
        default: (_mountPoint, runtime) => {
          remoteCalls.push(runtime?.initialPathname ?? "");
          return () => {};
        },
      }),
    });

    const { root } = await render(
      <MemoryRouter initialEntries={["/remote/apps"]}>
        <RemoteApp />
      </MemoryRouter>,
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent<NavigationDetails>("[/remote] - navigated", {
          detail: {
            pathname: "/tokens",
            basename: "/remote",
            operation: "push",
          },
        }),
      );
      await flushEffects();
    });

    expect(remoteCalls).toEqual(["/apps"]);

    await unmount(root);
  });

  test("uses replace navigation events without reinitializing the remote", async () => {
    window.history.replaceState({}, "", "/root/host/remote/apps");

    const remoteCalls: string[] = [];
    const RemoteApp = loadRemoteApp({
      basename: "/remote",
      moduleLoader: Promise.resolve({
        default: (_mountPoint, runtime) => {
          remoteCalls.push(runtime?.initialPathname ?? "");
          return () => {};
        },
      }),
    });

    const { root } = await render(
      <MemoryRouter initialEntries={["/remote/apps"]}>
        <RemoteApp />
      </MemoryRouter>,
    );

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent<NavigationDetails>("[/remote] - navigated", {
          detail: {
            pathname: "/tokens",
            basename: "/remote",
            operation: "replace",
          },
        }),
      );
      await flushEffects();
    });

    expect(remoteCalls).toEqual(["/apps"]);

    await unmount(root);
  });

  test("calls the remote cleanup callback on unmount", async () => {
    let cleanupCalls = 0;
    const RemoteApp = loadRemoteApp({
      basename: "/remote",
      moduleLoader: Promise.resolve({
        default: () => {
          return () => {
            cleanupCalls += 1;
          };
        },
      }),
    });

    const { root } = await render(
      <MemoryRouter initialEntries={["/remote/apps"]}>
        <RemoteApp />
      </MemoryRouter>,
    );

    await unmount(root);

    expect(cleanupCalls).toBe(1);
  });

  test("rewrites anchors inserted after mount through the mutation observer", async () => {
    window.history.replaceState({}, "", "/root/host/remote/apps");
    window.remotes = { "/cart": "/cart", "/remote": "/remote" };

    let mountPointRef: HTMLElement | null = null;
    const RemoteApp = loadRemoteApp({
      basename: "/remote",
      moduleLoader: Promise.resolve({
        default: (mountPoint) => {
          mountPointRef = mountPoint;
          return () => {};
        },
      }),
    });

    const { root } = await render(
      <MemoryRouter initialEntries={["/remote/apps"]}>
        <RemoteApp />
      </MemoryRouter>,
    );

    await act(async () => {
      mountPointRef?.insertAdjacentHTML(
        "beforeend",
        '<a href="/cart/list">Cart list</a>',
      );
      await flushEffects();
    });

    const anchor = mountPointRef?.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/root/host/cart/list");

    await unmount(root);
  });

  test("supports a custom mountPath when rewriting public hrefs", async () => {
    window.history.replaceState({}, "", "/root/host/settings/apps");

    const RemoteApp = loadRemoteApp({
      basename: "/remote",
      mountPath: "/settings",
      moduleLoader: Promise.resolve({
        default: (mountPoint) => {
          mountPoint.innerHTML = '<a href="/tokens">Tokens</a>';
          return () => {};
        },
      }),
    });

    const { container, root } = await render(
      <MemoryRouter initialEntries={["/settings/apps"]}>
        <RemoteApp />
      </MemoryRouter>,
    );

    await act(async () => {
      await flushEffects();
    });

    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("/root/host/settings/tokens");

    await unmount(root);
  });
});

describe("createRemoteApp", () => {
  test("dispatches host navigation events with the mounted remote path", async () => {
    const events: NavigationDetails[] = [];
    window.remotes = { "/remote": "/remote" };

    const listener = (event: Event) => {
      events.push((event as CustomEvent<NavigationDetails>).detail);
    };

    window.addEventListener("[/remote] - navigated", listener as EventListener);

    const mountPoint = createContainer();
    const unmountRemote = createRemoteApp({
      basename: "/remote",
      RootComponent: () => <Outlet />,
      routes: [
        {
          path: "apps",
          element: <div>Apps</div>,
        },
        {
          path: "*",
          element: <div>Fallback</div>,
        },
      ],
    });

    let cleanup = () => {};
    await act(async () => {
      cleanup = unmountRemote(mountPoint, {
        initialPathname: "/apps",
        mountPath: "/remote",
      });
      await flushEffects();
    });

    expect(events).toContainEqual({
      pathname: "/remote/apps",
      basename: "/remote",
      operation: "push",
    });

    await act(async () => {
      cleanup();
      await flushEffects();
    });

    window.removeEventListener(
      "[/remote] - navigated",
      listener as EventListener,
    );
  });

  test("marks cross-remote navigation as replace", async () => {
    const events: NavigationDetails[] = [];
    window.remotes = { "/remote": "/remote", "/cart": "/cart" };

    const listener = (event: Event) => {
      events.push((event as CustomEvent<NavigationDetails>).detail);
    };

    window.addEventListener("[/remote] - navigated", listener as EventListener);

    const mountPoint = createContainer();
    const unmountRemote = createRemoteApp({
      basename: "/remote",
      RootComponent: () => <Outlet />,
      routes: [
        {
          path: "apps",
          element: <div>Apps</div>,
        },
        {
          path: "*",
          element: <div>Fallback</div>,
        },
      ],
    });

    let cleanup = () => {};
    await act(async () => {
      cleanup = unmountRemote(mountPoint, {
        initialPathname: "/apps",
        mountPath: "/remote",
      });
      await flushEffects();
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent<NavigationDetails>("[Navigation] - navigated", {
          detail: {
            pathname: "/cart/item",
            basename: "/remote",
            operation: "push",
          },
        }),
      );
      await flushEffects();
    });

    expect(events).toContainEqual({
      pathname: "/cart/item",
      basename: "/remote",
      operation: "replace",
    });

    await act(async () => {
      cleanup();
      await flushEffects();
    });

    window.removeEventListener(
      "[/remote] - navigated",
      listener as EventListener,
    );
  });

  test("ignores navigation events for a different remote basename", async () => {
    const events: NavigationDetails[] = [];
    window.remotes = { "/remote": "/remote", "/cart": "/cart" };

    const listener = (event: Event) => {
      events.push((event as CustomEvent<NavigationDetails>).detail);
    };

    window.addEventListener("[/remote] - navigated", listener as EventListener);

    const mountPoint = createContainer();
    const unmountRemote = createRemoteApp({
      basename: "/remote",
      RootComponent: () => <Outlet />,
      routes: [
        {
          path: "apps",
          element: <div>Apps</div>,
        },
        {
          path: "*",
          element: <div>Fallback</div>,
        },
      ],
    });

    let cleanup = () => {};
    await act(async () => {
      cleanup = unmountRemote(mountPoint, {
        initialPathname: "/apps",
        mountPath: "/remote",
      });
      await flushEffects();
    });

    const initialEventCount = events.length;

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent<NavigationDetails>("[Navigation] - navigated", {
          detail: {
            pathname: "/cart/item",
            basename: "/cart",
            operation: "push",
          },
        }),
      );
      await flushEffects();
    });

    expect(events).toHaveLength(initialEventCount);

    await act(async () => {
      cleanup();
      await flushEffects();
    });

    window.removeEventListener(
      "[/remote] - navigated",
      listener as EventListener,
    );
  });

  test("supports a custom mountPath when dispatching host navigation events", async () => {
    const events: NavigationDetails[] = [];
    window.remotes = { "/remote": "/remote" };

    const listener = (event: Event) => {
      events.push((event as CustomEvent<NavigationDetails>).detail);
    };

    window.addEventListener("[/remote] - navigated", listener as EventListener);

    const mountPoint = createContainer();
    const unmountRemote = createRemoteApp({
      basename: "/remote",
      RootComponent: () => <Outlet />,
      routes: [
        {
          path: "apps",
          element: <div>Apps</div>,
        },
      ],
    });

    let cleanup = () => {};
    await act(async () => {
      cleanup = unmountRemote(mountPoint, {
        initialPathname: "/apps",
        mountPath: "/settings",
      });
      await flushEffects();
    });

    expect(events).toContainEqual({
      pathname: "/settings/apps",
      basename: "/remote",
      operation: "push",
    });

    await act(async () => {
      cleanup();
      await flushEffects();
    });

    window.removeEventListener(
      "[/remote] - navigated",
      listener as EventListener,
    );
  });
});
