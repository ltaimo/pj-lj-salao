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
import { changePassword, clearSession, currentUser, hasSession, logoutSession } from "./api/client";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { OperationsPage } from "./pages/OperationsPage";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [passwordOpen,setPasswordOpen] = useState(false);
  const [passwordSaving,setPasswordSaving] = useState(false);
  const [passwordError,setPasswordError] = useState("");
  useEffect(() => {
    const listener = (e: Event) => setNotice((e as CustomEvent<string>).detail);
    window.addEventListener("operation-message", listener);
    return () => window.removeEventListener("operation-message", listener);
  }, []);
  useEffect(() => {if (!notice) return; const id = window.setTimeout(()=>setNotice(""), 7000); return ()=>clearTimeout(id);}, [notice]);
  const navigate = useNavigate();
  const authenticated = hasSession();
  const me = useQuery({queryKey:["current-user"],queryFn:currentUser,enabled:authenticated,retry:1});
  const [menuOpen,setMenuOpen] = useState(false);
  const required: Record<string,string> = {"/pos":"sales.create","/stock":"inventory.view","/vendas":"reports.sales","/relatorios":"reports.sales","/admin":"settings.manage"};
  const visible = (path:string) => !required[path] || Boolean(me.data?.permissions.includes(required[path]));

  async function logout() {
    try {await logoutSession();} catch { /* Always clear the local session, including offline logout. */ }
    clearSession();
    queryClient.clear();
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
      {notice && <div className="operation-toast" role="status">{notice}<button aria-label="Fechar aviso" onClick={()=>setNotice("")}>×</button></div>}
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
              {group.items.filter(item=>visible(item.to)).map((item) => (
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
            <strong>{me.data?.organizationName ?? "PJ&LJ Salão Unissex"}</strong>
            <span>{me.data ? `${me.data.name} · ${me.data.branchName}` : "A carregar a sessão…"}</span>
          </div>
          <div className="button-row"><button type="button" onClick={()=>setPasswordOpen(true)}>Palavra-passe</button><button className="login-link" type="button" onClick={logout}><LogOut size={18} /> Sair</button></div>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="bottom-nav">
        {mobileItems.filter(item=>visible(item.to)).map((item) => (
          <NavLink key={item.to} to={item.to}>
            <item.icon size={20} />
            <span>{item.label === "Dashboard" ? "Home" : item.label.replace(" e fila", "")}</span>
          </NavLink>
        ))}
        <button type="button" onClick={()=>setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
          <Menu size={20} />
          <span>Mais</span>
        </button>
      </nav>
      {menuOpen && <nav className="mobile-module-menu" aria-label="Todos os módulos">{moduleGroups.flatMap(g=>g.items).filter(item=>visible(item.to)).map(item=><NavLink key={item.to} to={item.to} onClick={()=>setMenuOpen(false)}><item.icon size={20}/>{item.label}</NavLink>)}</nav>}
      {passwordOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Alterar palavra-passe"><form className="tool-panel password-panel" onSubmit={async e=>{
        e.preventDefault(); const fd=new FormData(e.currentTarget);setPasswordError("");
        if(fd.get("newPassword")!==fd.get("confirmPassword")){setPasswordError("As novas palavras-passe não coincidem.");return;}
        setPasswordSaving(true);
        try {await changePassword({currentPassword:String(fd.get("currentPassword")),newPassword:String(fd.get("newPassword"))});setPasswordOpen(false);await logout();}
        catch(error){setPasswordError(error instanceof Error?error.message:"Não foi possível alterar.");}
        finally {setPasswordSaving(false);}
      }}><h2>Alterar palavra-passe</h2><p>Depois de guardar, entre novamente com a nova palavra-passe.</p>
        <label>Palavra-passe atual<input name="currentPassword" type="password" autoComplete="current-password" required/></label>
        <label>Nova palavra-passe<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        <label>Confirmar nova palavra-passe<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label>
        {passwordError&&<p role="alert">{passwordError}</p>}<div className="button-row"><button disabled={passwordSaving}>Guardar</button><button type="button" disabled={passwordSaving} onClick={()=>setPasswordOpen(false)}>Cancelar</button></div>
      </form></div>}
    </div>
  );
}
