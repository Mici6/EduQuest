import type { Metadata } from "next";
import { Search } from "lucide-react";
import { AddPersonButton, ToggleActiveButton } from "@/components/admin/people-tools";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { requireActor } from "@/lib/auth/current";
import { ROLE_LABEL } from "@/lib/auth/types";
import { getDb } from "@/lib/db";
import { allClasses, listPeople } from "@/lib/domain/admin";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({ searchParams }: PageProps<"/app/admin/people">) {
  const actor = await requireActor(["admin"]);
  const sp = await searchParams;
  const role = typeof sp.role === "string" ? sp.role : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const db = getDb();
  const people = listPeople(db, actor, { role, q });
  const qs = (r: string) => `/app/admin/people?${new URLSearchParams({ ...(r ? { role: r } : {}), ...(q ? { q } : {}) })}`;
  return (
    <div>
      <PageHeader eyebrow="School administration" title="People" description="Students, teachers and staff. Role determines what each person can access." actions={<AddPersonButton classes={allClasses(db, actor.schoolId).map((c) => ({ id: c.id, name: c.name }))} />} />
      <div className="mb-5 flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <LinkTabs
          label="Filter by role"
          items={[
            { href: qs(""), label: "Everyone", active: !role },
            { href: qs("student"), label: "Students", active: role === "student" },
            { href: qs("teacher"), label: "Teachers", active: role === "teacher" },
            { href: qs("admin"), label: "Admins", active: role === "admin" },
            { href: qs("support"), label: "Support", active: role === "support" },
          ]}
        />
        <form action="/app/admin/people" className="relative w-full @3xl:w-72" role="search">
          {role ? <input type="hidden" name="role" value={role} /> : null}
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
          <label htmlFor="people-q" className="sr-only">
            Search people
          </label>
          <input id="people-q" name="q" defaultValue={q} placeholder="Search name or email" className="h-10 w-full rounded-full border border-line bg-ink-900/80 pl-10 pr-4 text-sm placeholder:text-fg-3 focus:border-sun-300/60 focus:outline-none" />
        </form>
      </div>
      <Card className="!p-0">
        <ul className="divide-y divide-line/60">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              <Avatar name={p.display_name} hue={p.avatar_hue} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {p.display_name} {!p.active ? <Badge tone="rose">Inactive</Badge> : null}
                </p>
                <p className="truncate text-xs text-fg-3">
                  {p.email}
                  {p.classes ? ` · ${p.classes}` : p.title ? ` · ${p.title}` : ""}
                </p>
              </div>
              <Badge tone={p.role === "student" ? "sun" : p.role === "teacher" ? "iris" : p.role === "admin" ? "sky" : "mint"}>{ROLE_LABEL[p.role]}</Badge>
              <ToggleActiveButton userId={p.id} name={p.display_name} active={!!p.active} self={p.id === actor.id} />
            </li>
          ))}
          {!people.length ? <li className="px-5 py-8 text-center text-sm text-fg-3">No one matches your search.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
