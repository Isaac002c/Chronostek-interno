"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Home,
} from "lucide-react";
import type { Role } from "@prisma/client";
import {
  visibleNavItems,
  getActiveNavItem,
  getVisibleTabs,
  firstAccessibleHref,
  type NavItem,
  type NavTab,
} from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/enums";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Logo, TelunMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/shell/global-search";
import { Notifications } from "@/components/shell/notifications";
import type { NotificationItem } from "@/lib/notifications";

type ShellUser = { name: string; email: string; role: Role };

function isActivePath(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

/** Aba ativa = a de href mais específico que casa com a rota. */
function getActiveTab(tabs: NavTab[], pathname: string): NavTab | undefined {
  return tabs
    .filter((t) => isActivePath(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function AppShell({
  user,
  notifications,
  children,
}: {
  user: ShellUser;
  notifications: NotificationItem[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const items = visibleNavItems(user.role);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const activeItem = getActiveNavItem(pathname);
  const tabs = activeItem ? getVisibleTabs(activeItem.key, user.role) : [];
  const activeTab = getActiveTab(tabs, pathname);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-200 lg:flex",
          collapsed ? "w-[4.5rem]" : "w-60",
        )}
      >
        <SidebarContent
          items={items}
          role={user.role}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
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
              role={user.role}
              pathname={pathname}
              collapsed={false}
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
          <GlobalSearch role={user.role} />
          <div className="flex-1" />
          <Notifications items={notifications} />
          <ThemeToggle />
          <UserMenu user={user} />
        </header>

        {/* Barra de contexto: breadcrumb + abas do módulo */}
        {activeItem && (
          <ContextBar activeItem={activeItem} tabs={tabs} activeTab={activeTab} />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  items,
  role,
  pathname,
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  items: NavItem[];
  role: Role;
  pathname: string;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <Link href="/dashboard" onClick={onNavigate} aria-label={BRAND.name}>
          {collapsed ? <TelunMark className="size-8" /> : <Logo />}
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = item.match.some((m) =>
            isActivePath(pathname, m, item.exact),
          );
          const href = firstAccessibleHref(item, role);
          return (
            <Link
              key={item.key}
              href={href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-accent/15 text-sidebar-accent"
                  : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div
        className={cn(
          "flex items-center border-t border-sidebar-border p-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <p className="truncate px-1 text-xs text-sidebar-foreground/40">
            {BRAND.name} · {BRAND.tagline}
          </p>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden size-8 shrink-0 place-items-center rounded-md text-sidebar-foreground/60 hover:bg-white/5 hover:text-sidebar-foreground lg:grid"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        )}
      </div>
    </>
  );
}

function ContextBar({
  activeItem,
  tabs,
  activeTab,
}: {
  activeItem: NavItem;
  tabs: NavTab[];
  activeTab: NavTab | undefined;
}) {
  const hasTabs = tabs.length > 1;
  const showBreadcrumb = !activeItem.exact; // não mostra na Início

  if (!hasTabs && !showBreadcrumb) return null;

  return (
    <div className="sticky top-14 z-20 border-b bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px]">
        {showBreadcrumb && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 pt-2.5 text-xs text-muted-foreground">
            <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground">
              <Home className="size-3.5" />
              Início
            </Link>
            <span>/</span>
            <span className={cn(activeTab ? "" : "text-foreground")}>{activeItem.label}</span>
            {activeTab && (
              <>
                <span>/</span>
                <span className="text-foreground">{activeTab.label}</span>
              </>
            )}
          </nav>
        )}

        {hasTabs && (
          <div className="scrollbar-thin -mb-px flex gap-1 overflow-x-auto pt-2">
            {tabs.map((t) => {
              const active = activeTab?.href === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
          <span className="max-w-[140px] truncate text-sm font-medium">{user.name}</span>
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
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-error transition-colors hover:bg-secondary"
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
