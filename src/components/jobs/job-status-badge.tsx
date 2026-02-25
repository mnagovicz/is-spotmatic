"use client";

import { Badge } from "@/components/ui/badge";
import { JobStatus } from "@/generated/prisma/client";
import { useTranslation } from "@/lib/i18n";

const statusConfig: Record<JobStatus, { key: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { key: "status.draft", variant: "secondary" },
  AWAITING_APPROVAL: { key: "status.awaitingApproval", variant: "outline" },
  PENDING: { key: "status.pending", variant: "secondary" },
  DOWNLOADING: { key: "status.downloading", variant: "outline" },
  GENERATING_TTS: { key: "status.generatingTts", variant: "default" },
  RENDERING: { key: "status.rendering", variant: "default" },
  MIXING: { key: "status.mixing", variant: "default" },
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
          : status === "GENERATING_TTS"
          ? "bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/30"
          : status === "MIXING"
          ? "bg-cyan-100 text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
          : status === "DOWNLOADING" || status === "UPLOADING"
          ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
          : status === "AWAITING_APPROVAL"
          ? "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/30"
          : status === "DRAFT"
          ? "bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-900/30 dark:text-gray-400 dark:hover:bg-gray-900/30"
          : status === "REJECTED"
          ? "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/30"
          : undefined
      }
    >
      {t(config.key)}
    </Badge>
  );
}
