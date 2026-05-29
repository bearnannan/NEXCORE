"use client";

import React, { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Settings, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LineBotSettings {
  LINE_TOKEN: string;
  GROUP_ID: string;
  line_backup_token: string;
  line_backup_group_id: string;
  fallback_email_to: string;
}

interface LineBotSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const emptySettings: LineBotSettings = {
  LINE_TOKEN: "",
  GROUP_ID: "",
  line_backup_token: "",
  line_backup_group_id: "",
  fallback_email_to: "",
};

export default function LineBotSettingsModal({ isOpen, onClose }: LineBotSettingsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [settings, setSettings] = useState<LineBotSettings>(emptySettings);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setError(null);

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load settings");
        if (!isMounted) return;
        const lineToken = json.LINE_TOKEN || json.line_backup_token || "";
        const groupId = json.GROUP_ID || json.line_backup_group_id || "";
        setSettings({
          LINE_TOKEN: lineToken,
          GROUP_ID: groupId,
          line_backup_token: lineToken,
          line_backup_group_id: groupId,
          fallback_email_to: json.fallback_email_to || "",
        });
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load settings");
      }
    };

    void fetchSettings();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const updateSetting = (key: keyof LineBotSettings, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSaveSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to save settings");
        toast.success("บันทึกค่ากำหนด LINE Notification เรียบร้อยแล้ว");
        onClose();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update settings";
        setError(message);
        toast.error(message);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close LINE bot settings"
        className="absolute inset-0 cursor-default bg-slate-950/80 backdrop-blur-md border-0"
        onClick={onClose}
      />
      
      {/* Dialog Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-cyan-500/25 bg-slate-900/95 shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Colorful Glow Accent Bar */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-cyan-400 via-yellow-400 to-transparent" />
        
        {/* Dynamic Glow Circles */}
        <div className="absolute -right-28 -top-28 -z-10 h-56 w-56 rounded-full bg-yellow-400/5 blur-[80px]" />
        <div className="absolute -bottom-28 -left-28 -z-10 h-56 w-56 rounded-full bg-cyan-400/5 blur-[80px]" />

        <form onSubmit={handleSaveSettings} className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-yellow-500/25 bg-yellow-500/10 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                <Settings className="size-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-sm font-bold tracking-wide text-slate-100 uppercase"
                >
                  LINE Bot Settings
                </h2>
                <p id={descriptionId} className="mt-1 text-[11px] text-slate-400">
                  Manage LINE incident notification credentials and fallback email configurations.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close LINE bot settings"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-cyan-500/10 bg-cyan-500/5 text-slate-400 transition-all hover:border-cyan-400/30 hover:bg-cyan-500/15 hover:text-cyan-200"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Errors Banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-200">
              <AlertTriangle className="size-4 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <SettingsField label="LINE Channel Access Token">
              <input
                type="password"
                value={settings.LINE_TOKEN}
                onChange={(event) => updateSetting("LINE_TOKEN", event.target.value)}
                className="h-10 w-full rounded-md border border-cyan-100/10 bg-slate-950 px-3 text-xs text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                placeholder="Paste your LINE Channel Access Token here..."
                autoComplete="off"
              />
            </SettingsField>

            <SettingsField label="Target LINE Group ID">
              <input
                value={settings.GROUP_ID}
                onChange={(event) => updateSetting("GROUP_ID", event.target.value)}
                className="h-10 w-full rounded-md border border-cyan-100/10 bg-slate-950 px-3 text-xs text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                placeholder="e.g. C1234567890abcdef..."
                autoComplete="off"
              />
            </SettingsField>

            <SettingsField label="Fallback SMTP/Brevo Email Address">
              <input
                type="email"
                value={settings.fallback_email_to}
                onChange={(event) => updateSetting("fallback_email_to", event.target.value)}
                className="h-10 w-full rounded-md border border-cyan-100/10 bg-slate-950 px-3 text-xs text-slate-100 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                placeholder="e.g. dopa-only-tm@forth.co.th"
                autoComplete="email"
              />
            </SettingsField>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
              className="h-8 text-xs uppercase font-bold tracking-wider text-slate-400 hover:text-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-8 cursor-pointer bg-cyan-400 text-xs font-mono font-black text-slate-950 hover:bg-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)] transition-all uppercase tracking-wider"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
