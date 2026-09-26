import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { login, setSession } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  remember: z.boolean().default(true)
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const queryClient = useQueryClient();
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
      queryClient.clear();
      setSession(result, values.remember);
      navigate("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao iniciar sessão");
    }
  }

  return (
    <main className="login-page centered-login">
      <form onSubmit={handleSubmit(onSubmit)} className="login-panel" aria-labelledby="login-title">
        <header className="login-heading">
          <img src="/pjlj-logo.jpg" alt="PJ&LJ Salão Unissex" width="88" height="88" />
          <h1 id="login-title">Bem-vindo</h1>
          <p>Entre na sua conta.</p>
        </header>
        <label>
          <span>Email</span>
          <div className="input-row">
            <Mail size={18} />
            <input type="email" autoComplete="username" placeholder="O seu email" aria-invalid={Boolean(formState.errors.email)} {...register("email")} />
          </div>
          {formState.errors.email && <small>Email inválido.</small>}
        </label>
        <label>
          <span>Palavra-passe</span>
          <div className="input-row">
            <LockKeyhole size={18} />
            <input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="A sua palavra-passe" aria-invalid={Boolean(formState.errors.password)} {...register("password")} />
            <button className="icon-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {formState.errors.password && <small>Mínimo de 8 caracteres.</small>}
        </label>
        <div className="login-options">
          <label className="check-row">
            <input type="checkbox" {...register("remember")} />
            <span>Manter sessão</span>
          </label>
          <button className="link-button" type="button" onClick={() => setMessage("Contacte a administração para recuperar o acesso.")}>Recuperar acesso</button>
        </div>
        <button className="primary-action" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "A entrar..." : "Entrar no sistema"}
        </button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </main>
  );
}
