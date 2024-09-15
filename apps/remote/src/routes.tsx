import { Tokens } from "./pages/tokens";
import { Apps } from "./pages/apps";
import { Layout } from "./layout";
import { Home } from "./pages/home";
import { createRemoteApp } from "navigation/router";

export const RemoteApp = createRemoteApp({
	routes: [
		{
			path: "",
			element: <Home />,
		},
		{
			path: "tokens",
			element: <Tokens />,
		},
		{
			path: "apps",
			element: <Apps />,
		},
		{
			path: "*",
			element: <div>404</div>,
		}
	],
	basename: "/remote",
	RootComponent: Layout
});
