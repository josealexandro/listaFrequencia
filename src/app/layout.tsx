import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Controle de Presença",
  description:
    "Sistema de chamada online e acompanhamento de frequência dos alunos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem("theme");
                var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                var dark = savedTheme ? savedTheme === "dark" : prefersDark;
                document.documentElement.classList.toggle("dark", dark);
              } catch (e) {}
            `,
          }}
        />
        <AuthProvider>{children}</AuthProvider>
        <ThemeToggle />
      </body>
    </html>
  );
}
