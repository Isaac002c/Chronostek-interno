"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, LogOut, ChevronDown } from "lucide-react";
import type { Role } from "@prisma/client";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { canAccessModule } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type ShellUser = { name: string; email: string; role: Role };

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => canAccessModule(user.role, i.module));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <SidebarContent items={items} pathname={pathname} />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 grid size-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-white/10"
              aria-label="Fechar menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent
              items={items}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </Button>
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu user={user} />
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const exact = item.href === "/dashboard";
          const parentActive = item.children
            ? item.children.some((c) => isActive(c.href))
            : isActive(item.href, exact);
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  parentActive
                    ? "bg-sidebar-accent/15 text-sidebar-accent"
                    : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
              {item.children && (
                <div className="ml-[26px] mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                  {item.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={onNavigate}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm transition-colors",
                        isActive(c.href)
                          ? "font-medium text-sidebar-accent"
                          : "text-sidebar-foreground/55 hover:text-sidebar-foreground",
                      )}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground/40">
          Chronostek · Sistema Interno
        </p>
      </div>
    </>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-secondary"
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials || "U"}
        </span>
        <span className="hidden flex-col text-left leading-tight sm:flex">
          <span className="max-w-[140px] truncate text-sm font-medium">
            {user.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {ROLE_LABELS[user.role] ?? user.role}
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 transition-colors hover:bg-secondary dark:text-red-400"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}
