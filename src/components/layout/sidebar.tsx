"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileVideo,
  Layers,
  Building2,
  Server,
  Plus,
  ClipboardCheck,
} from "lucide-react";
import { UserRole } from "@/generated/prisma/client";
import { useTranslation } from "@/lib/i18n";

interface SidebarProps {
  userRole: UserRole;
}

const navigation = [
  { key: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "OPERATOR"] },
  { key: "nav.approvals", href: "/approvals", icon: ClipboardCheck, roles: ["ADMIN", "OPERATOR"] },
  { key: "nav.jobs", href: "/jobs", icon: FileVideo, roles: ["ADMIN", "OPERATOR"] },
  { key: "nav.newJob", href: "/jobs/new", icon: Plus, roles: ["ADMIN"] },
  { key: "nav.templates", href: "/templates", icon: Layers, roles: ["ADMIN", "OPERATOR"] },
  { key: "nav.organizations", href: "/organizations", icon: Building2, roles: ["ADMIN"] },
  { key: "nav.agents", href: "/agents", icon: Server, roles: ["ADMIN"] },
];

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex h-full w-64 flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-lg font-bold text-foreground">
          {t("nav.logo")}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {filteredNav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
