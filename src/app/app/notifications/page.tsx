import type { Metadata } from "next";
import Link from "next/link";
import { NotificationList } from "@/components/account/notification-list";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { NOTIFICATION_CATEGORIES, listNotifications, unreadCount } from "@/lib/domain/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/app/notifications">) {
  const actor = await requireActor();
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const db = getDb();
  const items = listNotifications(db, actor, { category: filter === "unread" ? undefined : filter, unreadOnly: filter === "unread", limit: 100 });
  const tabs = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    ...NOTIFICATION_CATEGORIES.filter((c) => c.id !== "system" || actor.role !== "student").map((c) => ({ id: c.id, label: c.label })),
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={
          <>
            Choose what you're notified about in <Link href="/app/settings" className="text-sun-200 underline-offset-2 hover:underline">Settings</Link>.
          </>
        }
      />
      <LinkTabs label="Notification categories" className="mb-5" items={tabs.map((t) => ({ href: t.id === "all" ? "/app/notifications" : `/app/notifications?filter=${t.id}`, label: t.label, active: filter === t.id }))} />
      <NotificationList items={items} unread={unreadCount(db, actor)} />
    </div>
  );
}
