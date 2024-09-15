import { Item } from "./pages/item";
import { List } from "./pages/list";
import { Layout } from "./layout";
import { Home } from "./pages/home";
import { createRemoteApp } from "navigation/router";

export const CartApp = createRemoteApp({
	routes: [
		{
			path: "",
			element: <Home />,
		},
		{
			path: "list",
			element: <List />,
		},
		{
			path: "item",
			element: <Item />,
		},
		{
			path: "*",
			element: <div>404 cart</div>
		}
	],
	basename: "/cart",
	RootComponent: Layout
});
