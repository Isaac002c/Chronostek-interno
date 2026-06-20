import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-sky-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 text-lg font-bold text-white shadow-lg">
            C
          </div>
          <span className="text-xl font-semibold tracking-tight">
            Chronos<span className="text-sidebar-accent">tek</span>
          </span>
        </div>

        <div className="relative space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Centro operacional da Chronostek.
          </h1>
          <p className="max-w-md text-sidebar-foreground/70">
            Financeiro, comercial, marketing, inovação, jurídico, metas e
            tarefas — tudo num só lugar, com dados reais e visão em tempo real.
          </p>
        </div>

        <p className="relative text-sm text-sidebar-foreground/40">
          © {new Date().getFullYear()} Chronostek · Sistema Interno
        </p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 font-bold text-white">
                C
              </div>
              <span className="text-lg font-semibold tracking-tight">
                Chronos<span className="text-primary">tek</span>
              </span>
            </div>
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
