import { Link, Outlet } from "react-router-dom";

export function Layout() {

	return (
		<div>
			<span>Cart</span>
			<div style={{ display: 'flex', gap: 10 }}>
				<Link to="/item">From Cart to Cart/item</Link>
				<Link to="/list">From Cart to Cart/List</Link>
				<Link to={'/remote/apps'}>From Cart to Remote/App</Link>
				<Link to="/remote/tokens">From Cart to Remote/Tokens</Link>
				<Link to="/root/home-test">From Cart to Home Test</Link>
			</div>
			<Outlet />
		</div>
	)
}
