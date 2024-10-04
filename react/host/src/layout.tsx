import { Link, Outlet } from "react-router-dom";

export function Layout() {

  return (
    <div style={{ display: 'flex', gap: 10, flexDirection: "column" }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <Link to="/">Home</Link>
        <Link to="/remote/apps">From Host to Remote/App</Link>
        <Link to="/remote/tokens">From Host to Remote/Tokens</Link>
        <Link to="/cart/item">From Host to Cart/item</Link>
        <Link to="/cart/list">From Host to Cart/List</Link>
      </div>
      <Outlet />
    </div>
  );
}
