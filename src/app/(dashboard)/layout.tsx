import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import { UserRole } from "@/generated/prisma/client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === "CLIENT") {
    redirect("/portal");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userRole={session.user.role as UserRole} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={session.user.name} userRole={session.user.role} />
        <main className="flex-1 overflow-auto bg-muted p-6">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
