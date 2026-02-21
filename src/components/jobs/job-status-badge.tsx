"use client";

import { Badge } from "@/components/ui/badge";
import { JobStatus } from "@/generated/prisma/client";
import { useTranslation } from "@/lib/i18n";

const statusConfig: Record<JobStatus, { key: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  AWAITING_APPROVAL: { key: "status.awaitingApproval", variant: "outline" },
  PENDING: { key: "status.pending", variant: "secondary" },
  DOWNLOADING: { key: "status.downloading", variant: "outline" },
  RENDERING: { key: "status.rendering", variant: "default" },
  UPLOADING: { key: "status.uploading", variant: "outline" },
  COMPLETED: { key: "status.completed", variant: "default" },
  FAILED: { key: "status.failed", variant: "destructive" },
  REJECTED: { key: "status.rejected", variant: "destructive" },
  MANUAL: { key: "status.manual", variant: "secondary" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { t } = useTranslation();
  const config = statusConfig[status];
  return (
    <Badge
      variant={config.variant}
      className={
        status === "COMPLETED"
          ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/30"
          : status === "RENDERING"
          ? "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/30"
          : status === "DOWNLOADING" || status === "UPLOADING"
          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
          : status === "AWAITING_APPROVAL"
          ? "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/30"
          : status === "REJECTED"
          ? "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30"
          : undefined
      }
    >
      {t(config.key)}
    </Badge>
  );
}
