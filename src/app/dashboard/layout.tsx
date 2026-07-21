import { requireUser } from "@/lib/session";
import { getUserNotifications } from "@/lib/notifications";
import { AppShell } from "@/components/shell/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const notifications = await getUserNotifications({ id: user.id, role: user.role });

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
