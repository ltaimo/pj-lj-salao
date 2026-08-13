import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { login } from "../api/client";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type LoginForm = z.infer<typeof schema>;

export function LoginPage() {
  const [message, setMessage] = useState<string>();
  const { register, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "admin@pjlj.local",
      password: "change-me-before-production"
    }
  });

  async function onSubmit(values: LoginForm) {
    setMessage(undefined);
    try {
      const result = await login(values.email, values.password);
      localStorage.setItem("pjlj.accessToken", result.accessToken);
      localStorage.setItem("pjlj.refreshToken", result.refreshToken);
      setMessage(`Sessao iniciada como ${result.user.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao iniciar sessao");
    }
  }

  return (
    <section className="login-page">
      <form onSubmit={handleSubmit(onSubmit)} className="login-panel">
        <h1>Entrar</h1>
        <label>
          <span>Email</span>
          <div className="input-row">
            <Mail size={18} />
            <input type="email" {...register("email")} />
          </div>
          {formState.errors.email && <small>Email invalido.</small>}
        </label>
        <label>
          <span>Password</span>
          <div className="input-row">
            <LockKeyhole size={18} />
            <input type="password" {...register("password")} />
          </div>
          {formState.errors.password && <small>Minimo de 8 caracteres.</small>}
        </label>
        <button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "A entrar..." : "Entrar"}
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
