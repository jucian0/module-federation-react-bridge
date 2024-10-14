import { Link, Outlet } from "react-router-dom";

export function Layout() {

	return (
		<div>
			<span>Remote</span>
			<div style={{ display: 'flex', gap: 10 }}>
				<Link to="/apps">From Remote to Apps</Link>
				<Link to="/tokens">From Remote to Tokens</Link>
				<Link to="/cart/item" relative="route">From Remote to Cart/item</Link>
				<Link to="/cart/list" relative="route">From Remote to Cart/List</Link>
				<Link to="/root/home-test" relative="route">From Remote to Home Test</Link>
			</div>
			<Outlet />
		</div>
	)
}
