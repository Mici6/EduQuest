import { SnowLeopard } from "@/components/companion/snow-leopard";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <div className="mt-10 flex flex-col items-center">
      <SnowLeopard mood="thinking" className="-mb-6 size-28" />
      <EmptyState title="Irbis searched every ledge" className="w-full max-w-lg" action={<ButtonLink href="/app">Back to dashboard</ButtonLink>}>
        We couldn&apos;t find that page. It may have moved, or you may not have access to it.
      </EmptyState>
    </div>
  );
}
