import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./layout";
import React from "react";
import { Home } from "./pages/home";
import { loadRemoteApp } from "@module-federation-bridge/react";

const RemoteApp = loadRemoteApp({ moduleLoader: import('remote/app'), basename: '/remote' });
const CartApp = loadRemoteApp({ moduleLoader: import('cart/app'), basename: '/cart' });

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <Home />
      },
      {
        path: '/home-test',
        element: <div>Home Test</div>
      },
      {
        path: '/remote/*',
        element: <RemoteApp />,
        errorElement: <div>Error</div>
      },
      {
        path: '/cart/*',
        element: <CartApp />,
        errorElement: <div>Error</div>
      },
      {
        path: '*',
        element: <div>404 host</div>
      }
    ]
  }
])