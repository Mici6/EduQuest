import { redirect } from "next/navigation";
import { homeFor, requireActor } from "@/lib/auth/current";

export default async function AppIndex() {
  const actor = await requireActor();
  redirect(homeFor(actor.role));
}
