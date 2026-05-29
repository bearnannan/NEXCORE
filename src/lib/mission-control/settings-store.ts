import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export interface SystemSettings {
  LINE_TOKEN: string;
  GROUP_ID: string;
  line_backup_token: string;
  line_backup_group_id: string;
  fallback_email_to: string;
}

export const EMPTY_SYSTEM_SETTINGS: SystemSettings = {
  LINE_TOKEN: "",
  GROUP_ID: "",
  line_backup_token: "",
  line_backup_group_id: "",
  fallback_email_to: "",
};

const SETTINGS_FILE = path.join(process.cwd(), "data", "incident-system-settings.json");

export function normalizeSystemSettings(value: Partial<SystemSettings> = {}): SystemSettings {
  const lineToken = value.LINE_TOKEN || value.line_backup_token || "";
  const groupId = value.GROUP_ID || value.line_backup_group_id || "";

  return {
    LINE_TOKEN: lineToken,
    GROUP_ID: groupId,
    line_backup_token: value.line_backup_token || lineToken,
    line_backup_group_id: value.line_backup_group_id || groupId,
    fallback_email_to: value.fallback_email_to || "",
  };
}

export async function readLocalSystemSettings(): Promise<SystemSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    return normalizeSystemSettings(JSON.parse(raw) as Partial<SystemSettings>);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return EMPTY_SYSTEM_SETTINGS;
    }
    console.warn("Failed to read local incident settings fallback:", error);
    return EMPTY_SYSTEM_SETTINGS;
  }
}

export async function writeLocalSystemSettings(settings: SystemSettings): Promise<void> {
  await mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  // Exclude sensitive LINE tokens from local disk storage for security compliance
  const secureSettings = { ...settings, LINE_TOKEN: "", line_backup_token: "" };
  await writeFile(SETTINGS_FILE, JSON.stringify(normalizeSystemSettings(secureSettings), null, 2), "utf8");
}
