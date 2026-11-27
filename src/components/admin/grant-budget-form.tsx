"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { updateSchoolSettingsAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function GrantBudgetForm({ budget, currency }: { budget: number; currency: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(budget));
  const [cur, setCur] = useState(currency);
  return (
    <form
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateSchoolSettingsAction({ grantBudget: Number(amount) || 0, grantCurrency: cur.trim().toUpperCase() });
          toast(res.ok ? { tone: "success", title: "Grant budget saved" } : { tone: "error", title: "Couldn't save", body: res.error });
        });
      }}
    >
      <Field label="Total grant budget" htmlFor="gb-amount">
        <Input id="gb-amount" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Currency" htmlFor="gb-cur">
        <Input id="gb-cur" value={cur} maxLength={3} onChange={(e) => setCur(e.target.value)} pattern="[A-Za-z]{3}" />
      </Field>
      <Button type="submit" loading={pending}>
        <Save /> Save
      </Button>
    </form>
  );
}
