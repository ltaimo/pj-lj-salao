import { CalendarDays, Home, LayoutDashboard, Menu, PackageSearch, Scissors, Settings, ShoppingCart, Users } from "lucide-react";
import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "POS", icon: ShoppingCart },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/servicos", label: "Servicos", icon: Scissors },
  { to: "/stock", label: "Stock", icon: PackageSearch },
  { to: "/admin", label: "Admin", icon: Settings }
];

function Placeholder({ title }: { title: string }) {
  return (
    <section className="content-shell">
      <h1>{title}</h1>
      <p>Modulo preparado na fundacao. A implementacao end-to-end entra nas proximas etapas do roadmap.</p>
    </section>
  );
}

export function App() {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <span>PJ&LJ</span>
          <small>Salon Manager</small>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <strong>PJ&LJ Salao Unissex</strong>
            <span>Africa/Maputo · MZN</span>
          </div>
          <a className="login-link" href="/login">Entrar</a>
        </header>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/pos" element={<Placeholder title="POS" />} />
          <Route path="/agenda" element={<Placeholder title="Agenda" />} />
          <Route path="/clientes" element={<Placeholder title="Clientes" />} />
          <Route path="/servicos" element={<Placeholder title="Servicos" />} />
          <Route path="/stock" element={<Placeholder title="Stock" />} />
          <Route path="/admin" element={<Placeholder title="Administracao" />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {navItems.slice(0, 5).map((item) => (
          <NavLink key={item.to} to={item.to}>
            <item.icon size={20} />
            <span>{item.label === "Dashboard" ? "Home" : item.label}</span>
          </NavLink>
        ))}
        <NavLink to="/admin">
          <Menu size={20} />
          <span>Mais</span>
        </NavLink>
      </nav>
    </div>
  );
}
