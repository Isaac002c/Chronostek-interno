import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { TelunMark, TelunWordmark } from "@/components/brand";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca — força visual cósmica */}
      <div className="bg-cosmic relative hidden flex-col justify-between overflow-hidden p-12 text-sidebar-foreground lg:flex">
        <div className="relative flex items-center gap-3">
          <TelunMark className="size-11" />
          <TelunWordmark className="text-2xl text-sidebar-foreground" />
        </div>

        <div className="relative space-y-4">
          <h1 className="max-w-md text-4xl font-semibold leading-tight">
            Tecnologia com <span className="text-gradient-brand">propósito</span>.
            Luz para conectar o futuro.
          </h1>
          <p className="max-w-md text-sidebar-foreground/70">
            Financeiro, comercial, projetos e tecnologia, marketing, jurídico,
            metas e tarefas — tudo num só lugar, com dados reais e visão em tempo
            real.
          </p>
          <p className="text-sm uppercase tracking-[0.2em] text-sidebar-foreground/40">
            {BRAND.motto}
          </p>
        </div>

        <p className="relative text-sm text-sidebar-foreground/40">
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-2.5 lg:hidden">
            <TelunMark className="size-9" />
            <TelunWordmark className="text-lg text-foreground" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              Acessar o sistema
            </h2>
            <p className="text-sm text-muted-foreground">
              Entre com suas credenciais para continuar.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </div>
  );
}
