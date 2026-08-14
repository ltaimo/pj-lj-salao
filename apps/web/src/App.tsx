import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Percent,
  Scissors,
  Settings,
  ShoppingCart,
  Users,
  WalletCards,
  LogOut
} from "lucide-react";
import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { clearSession, hasSession } from "./api/client";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OperationsPage } from "./pages/OperationsPage";

const moduleGroups = [
  {
    title: "Operação",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pos", label: "POS", icon: ShoppingCart },
      { to: "/agenda", label: "Agenda e fila", icon: CalendarDays }
    ]
  },
  {
    title: "Comercial",
    items: [
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/servicos", label: "Serviços", icon: Scissors },
      { to: "/stock", label: "Stock", icon: PackageSearch },
      { to: "/vendas", label: "Vendas", icon: WalletCards },
      { to: "/fidelizacao", label: "Fidelização", icon: Percent }
    ]
  },
  {
    title: "Gestão",
    items: [
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/admin", label: "Administração", icon: Settings }
    ]
  }
];

const mobileItems = [
  moduleGroups[0].items[0],
  moduleGroups[0].items[1],
  moduleGroups[0].items[2],
  moduleGroups[1].items[0],
  moduleGroups[2].items[1]
];

export function App() {
  const navigate = useNavigate();
  const authenticated = hasSession();

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  if (!authenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="brand">
          <img src="/pjlj-logo.jpg" alt="PJ&LJ Salão Unissex" />
          <span>PJ&LJ</span>
          <small>Salon Manager</small>
        </div>
        <nav className="side-nav">
          {moduleGroups.map((group) => (
            <section key={group.title}>
              <p>{group.title}</p>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <strong>PJ&LJ Salão Unissex</strong>
            <span>Operação · Caixa · CRM · Stock · Fidelização</span>
          </div>
          <button className="login-link" type="button" onClick={logout}><LogOut size={18} /> Sair</button>
        </header>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pos" element={<OperationsPage mode="pos" />} />
          <Route path="/agenda" element={<OperationsPage mode="agenda" />} />
          <Route path="/clientes" element={<OperationsPage mode="clientes" />} />
          <Route path="/servicos" element={<OperationsPage mode="servicos" />} />
          <Route path="/stock" element={<OperationsPage mode="stock" />} />
          <Route path="/vendas" element={<OperationsPage mode="vendas" />} />
          <Route path="/fidelizacao" element={<OperationsPage mode="fidelizacao" />} />
          <Route path="/relatorios" element={<OperationsPage mode="relatorios" />} />
          <Route path="/admin" element={<OperationsPage mode="admin" />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {mobileItems.map((item) => (
          <NavLink key={item.to} to={item.to}>
            <item.icon size={20} />
            <span>{item.label === "Dashboard" ? "Home" : item.label.replace(" e fila", "")}</span>
          </NavLink>
        ))}
        <NavLink to="/relatorios">
          <Menu size={20} />
          <span>Mais</span>
        </NavLink>
      </nav>
    </div>
  );
}
