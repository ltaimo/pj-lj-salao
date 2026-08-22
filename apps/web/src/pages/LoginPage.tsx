import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { login, setSession } from "../api/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().default(true)
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      remember: false
    }
  });

  async function onSubmit(values: LoginForm) {
    setMessage(undefined);
    try {
      const result = await login(values.email, values.password);
      setSession(result, values.remember);
      setMessage(`Sessão iniciada como ${result.user.name}`);
      navigate("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao iniciar sessão");
    }
  }

  return (
    <section className="login-page pro-login">
      <div className="login-brand-panel">
        <img src="/pjlj-logo.jpg" alt="PJ&LJ Salão Unissex" />
        <div>
          <p>Sistema integrado</p>
          <h1>PJ&LJ Salon Manager</h1>
          <span>Barbearia · Cabeleireiro · POS · Stock · Fidelização</span>
        </div>
        <div className="login-health ok">
          <ShieldCheck size={18} />
          Acesso reservado à equipa
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
            <input type="email" autoComplete="email" placeholder="utilizador@empresa.com" {...register("email")} />
          </div>
          {formState.errors.email && <small>Email inválido.</small>}
        </label>
        <label>
          <span>Palavra-passe</span>
          <div className="input-row">
            <LockKeyhole size={18} />
            <input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Introduza a palavra-passe" {...register("password")} />
            <button className="icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formState.errors.password && <small>Mínimo de 8 caracteres.</small>}
        </label>
        <div className="login-options">
          <label className="check-row">
            <input type="checkbox" {...register("remember")} />
            <span>Manter sessão neste dispositivo</span>
          </label>
          <button className="link-button" type="button" onClick={() => setMessage("Contacte a administração para recuperar o acesso.")}>Recuperar acesso</button>
        </div>
        <button className="primary-action" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "A entrar..." : "Entrar no sistema"}
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
