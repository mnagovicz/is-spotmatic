import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ClientHeader } from "@/components/layout/client-header";
import { Toaster } from "@/components/ui/sonner";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "CLIENT") {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ClientHeader userName={session.user.name} />
      <main className="flex-1 bg-muted">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
      <Toaster />
    </div>
  );
}
