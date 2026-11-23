import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { UserProvider } from "@/lib/userContext";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Perpetual Flow — Music Intelligence Platform",
  description: "Production Studio · Streaming · DJ Mode · A&R Discovery · Video Editor",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen h-full bg-[#f0f4f8] text-[#1a2a3a] antialiased">
        <StoreProvider>
          <UserProvider>
            <AppShell>{children}</AppShell>
          </UserProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
