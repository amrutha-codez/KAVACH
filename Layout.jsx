import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import { useApp } from "../context/AppContext";

// The frame around every page: the menu plus the page that is open
export default function Layout() {
  const { status, error, reload } = useApp();
  const { pathname } = useLocation();
  const isMap = pathname.startsWith("/navigate");

  let content;
  if (status === "loading") {
    content = <div className="loading">Loading Kavach…</div>;
  } else if (status === "error") {
    content = (
      <div className="card">
        <p className="small-title">Something went wrong</p>
        <p className="notice error">{error}</p>
        <button className="btn small" onClick={reload}>
          Try again
        </button>
      </div>
    );
  } else {
    content = <Outlet />;
  }

  return (
    <>
      <Navbar />
      <main className={"page" + (isMap && status === "ready" ? " full" : "")}>{content}</main>
    </>
  );
}
