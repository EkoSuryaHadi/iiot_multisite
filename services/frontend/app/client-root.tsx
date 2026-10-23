"use client";

import { AppSidebar } from "@/components/app-sidebar";
import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TenantProvider } from "@/contexts/TenantContext";
import { SessionProvider } from "next-auth/react";
import { Session } from "next-auth";
import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";

export function ClientRoot({
  defaultOpen,
  session,
  children,
}: {
  defaultOpen: boolean;
  session: Session | null;
  children: ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <TenantProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar />
            <main className="dashboard-body-wrapper grow flex flex-col min-w-0">
              <Header />
              <div className="dashboard-body bg-neutral-100 dark:bg-[#1e2734] md:p-6 p-4 flex-1">
                {children}
              </div>
              <Footer />
            </main>
            <Toaster position="top-center" reverseOrder={false} />
          </SidebarProvider>
        </TenantProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
