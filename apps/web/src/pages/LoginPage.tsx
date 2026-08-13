import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail, Wifi } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { health, login } from "../api/client";
import { useQuery } from "@tanstack/react-query";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().default(true)
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const apiHealth = useQuery({ queryKey: ["login-health"], queryFn: health, retry: 1 });
  const [message, setMessage] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "admin@pjlj.local",
      password: "change-me-before-production",
      remember: true
    }
  });

  async function onSubmit(values: LoginForm) {
    setMessage(undefined);
    try {
      const result = await login(values.email, values.password);
      const storage = values.remember ? localStorage : sessionStorage;
      storage.setItem("pjlj.accessToken", result.accessToken);
      storage.setItem("pjlj.refreshToken", result.refreshToken);
      localStorage.setItem("pjlj.accessToken", result.accessToken);
      localStorage.setItem("pjlj.refreshToken", result.refreshToken);
      setMessage(`Sessao iniciada como ${result.user.name}`);
      navigate("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao iniciar sessao");
    }
  }

  return (
    <section className="login-page pro-login">
      <div className="login-brand-panel">
        <img src="/pjlj-logo.jpg" alt="PJ&LJ Salao Unissex" />
        <div>
          <p>Sistema integrado</p>
          <h1>PJ&LJ Salon Manager</h1>
          <span>Barbearia · Cabeleireiro · POS · Stock · Fidelizacao</span>
        </div>
        <div className={apiHealth.isSuccess ? "login-health ok" : "login-health"}>
          <Wifi size={18} />
          {apiHealth.isSuccess ? "API online" : "A verificar API"}
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="login-panel">
        <div>
          <p>Acesso seguro</p>
          <h2>Entrar</h2>
        </div>
        <label>
          <span>Email</span>
          <div className="input-row">
            <Mail size={18} />
            <input type="email" autoComplete="email" {...register("email")} />
          </div>
          {formState.errors.email && <small>Email invalido.</small>}
        </label>
        <label>
          <span>Password</span>
          <div className="input-row">
            <LockKeyhole size={18} />
            <input type={showPassword ? "text" : "password"} autoComplete="current-password" {...register("password")} />
            <button className="icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar password" : "Mostrar password"}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formState.errors.password && <small>Minimo de 8 caracteres.</small>}
        </label>
        <div className="login-options">
          <label className="check-row">
            <input type="checkbox" {...register("remember")} />
            <span>Manter sessao neste dispositivo</span>
          </label>
          <button className="link-button" type="button">Recuperar acesso</button>
        </div>
        <button className="primary-action" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "A entrar..." : "Entrar no sistema"}
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
