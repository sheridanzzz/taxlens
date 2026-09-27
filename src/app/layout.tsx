import type { Metadata } from "next";
import { Caveat, Gabarito } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { AuthProvider } from "@/context/auth-context";
import { TaxProvider } from "@/context/tax-context";
import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  display: "swap",
});

// handwritten notes on the landing page only
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ledgr — your refund, filling up all year",
  description:
    "Chuck your work receipts in as you go, log your work-from-home hours, and watch your refund pot grow. Built on the ATO's rules for Australian employees.",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${gabarito.variable} ${caveat.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <AuthSessionProvider>
          <ThemeProvider>
            <TooltipProvider>
              <AuthProvider>
                <TaxProvider>
                  <AppShell>{children}</AppShell>
                </TaxProvider>
              </AuthProvider>
            </TooltipProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
};

export default RootLayout;
