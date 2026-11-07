import { NavLink } from "react-router-dom";
import { Home, Navigation, BarChart3, Users, User } from "lucide-react";
import "./Navbar.css";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/navigate", label: "Navigate", icon: Navigation },
  { to: "/charts", label: "Charts", icon: BarChart3 },
  { to: "/community", label: "Community", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
];

export default function Navbar() {
  return (
    <nav className="navbar" aria-label="Main menu">
      <div className="navbar-logo">Kavach</div>
      <ul className="navbar-links">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
