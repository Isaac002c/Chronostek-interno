import type { Metadata } from "next";
import { Toaster } from "sonner";
import { APP_TITLE, APP_TITLE_TEMPLATE, APP_DESCRIPTION } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
};

// Evita flash de tema (FOUC). Dark-first: a Telun é cósmica por padrão; só usa
// o tema claro quando o usuário escolheu explicitamente 'light'.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <Toaster richColors position="top-right" closeButton theme="dark" />
      </body>
    </html>
  );
}
