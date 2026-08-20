import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { PermissionProvider } from "@/context/PermissionContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BNWEMS - Quản lý sự kiện cưới",
  description: "Hệ thống quản lý nội bộ Bình Nguyên Wedding Event Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AuthProvider>
          <PermissionProvider>{children}</PermissionProvider>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
