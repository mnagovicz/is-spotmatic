"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PortalTemplatesPage() {
  const { data } = useSWR("/api/templates?active=true", fetcher);
  const { t } = useTranslation();

  const templates = data?.templates || data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("portal.templates.title")}</h1>
        <p className="text-muted-foreground">{t("portal.templates.subtitle")}</p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t("portal.templates.noTemplates")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(
            (template: {
              id: string;
              name: string;
              description: string | null;
              thumbnailUrl: string | null;
            }) => (
              <Card key={template.id} className="flex flex-col">
                {template.thumbnailUrl && (
                  <div className="aspect-video overflow-hidden rounded-t-lg bg-muted">
                    <img
                      src={template.thumbnailUrl}
                      alt={template.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}
                  <Link href={`/portal/order/${template.id}`}>
                    <Button className="w-full">
                      {t("portal.templates.select")}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
