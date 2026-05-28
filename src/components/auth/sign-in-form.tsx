"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirect: false,
      });

      if (result?.error) {
        setError("Operator credentials were not accepted.");
        return;
      }

      router.push("/mission-control");
      router.refresh();
    });
  }

  return (
    <form
      action={handleSubmit}
      className="w-full max-w-sm rounded-lg border border-cyan-200/15 bg-slate-950/85 p-6 shadow-2xl shadow-black/40"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
          <Radar className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-50">
            Mission Control
          </h1>
          <p className="text-xs text-slate-400">Operations operator sign-in</p>
        </div>
      </div>

      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
        Email
      </label>
      <Input
        name="email"
        type="email"
        defaultValue="operator@nexcore.local"
        autoComplete="username"
        className="mb-4 h-11 bg-slate-900/80"
      />

      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
        Password
      </label>
      <Input
        name="password"
        type="password"
        defaultValue="mission-control"
        autoComplete="current-password"
        className="mb-4 h-11 bg-slate-900/80"
      />

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <Button className="h-11 w-full" disabled={isPending}>
        <LockKeyhole className="size-4" />
        {isPending ? "Authenticating..." : "Enter Dashboard"}
      </Button>
    </form>
  );
}
