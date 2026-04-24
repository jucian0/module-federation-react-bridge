import { describe, expect, test } from "@rstest/core";
import {
  resolveAnchorPublicHref,
  resolveBrowserBasename,
  resolveHostNavigationPath,
} from "../src/path-utils";

describe("resolveBrowserBasename", () => {
  test("derives the host and root basename from the browser pathname", () => {
    expect(resolveBrowserBasename("/root/host/remote/apps", "/remote/apps")).toBe(
      "/root/host",
    );
  });
});

describe("resolveHostNavigationPath", () => {
  test("prefixes local remote routes with the remote mount path", () => {
    expect(resolveHostNavigationPath("/apps", "/remote")).toBe("/remote/apps");
  });

  test("keeps cross-remote routes untouched before the public basename is applied", () => {
    expect(resolveHostNavigationPath("/cart/item", "/remote", { "/cart": "/cart" })).toBe(
      "/cart/item",
    );
  });

  test("maps root-prefixed host routes back to the host app", () => {
    expect(resolveHostNavigationPath("/root/home-test", "/remote")).toBe(
      "/home-test",
    );
  });
});

describe("resolveAnchorPublicHref", () => {
  const origin = "https://github.com";
  const browserPathname = "/root/host/remote/apps";
  const routerPathname = "/remote/apps";
  const mountPath = "/remote";

  test("rewrites local remote links to include the public basenames", () => {
    expect(
      resolveAnchorPublicHref({
        href: "/tokens",
        origin,
        browserPathname,
        routerPathname,
        mountPath,
      }),
    ).toBe("/root/host/remote/tokens");
  });

  test("rewrites links to other remotes without dropping the public basenames", () => {
    expect(
      resolveAnchorPublicHref({
        href: "/cart/item",
        origin,
        browserPathname,
        routerPathname,
        mountPath,
        remotes: { "/cart": "/cart" },
      }),
    ).toBe("/root/host/cart/item");
  });

  test("rewrites host routes referenced through /root", () => {
    expect(
      resolveAnchorPublicHref({
        href: "/root/home-test",
        origin,
        browserPathname,
        routerPathname,
        mountPath,
      }),
    ).toBe("/root/host/home-test");
  });

  test("does not touch already-public urls", () => {
    expect(
      resolveAnchorPublicHref({
        href: "/root/host/remote/tokens",
        origin,
        browserPathname,
        routerPathname,
        mountPath,
      }),
    ).toBeNull();
  });

  test("does not rewrite external urls", () => {
    expect(
      resolveAnchorPublicHref({
        href: "https://example.com/docs",
        origin,
        browserPathname,
        routerPathname,
        mountPath,
      }),
    ).toBeNull();
  });
});
