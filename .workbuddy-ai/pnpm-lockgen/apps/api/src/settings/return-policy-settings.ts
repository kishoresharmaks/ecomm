import { Prisma } from "@indihub/database";
import { readNumberSetting } from "./setting-value-utils";

export const returnPolicySettingKeys = {
  returnWindowDays: "returns.return_window_days",
  replacementWindowDays: "returns.replacement_window_days",
} as const;

export const returnPolicySettingGroup = "returns";

export const defaultReturnPolicySettings = {
  returnWindowDays: 7,
  replacementWindowDays: 7,
} as const;

export type ReturnPolicySettings = {
  returnWindowDays: number;
  replacementWindowDays: number;
};

type SettingReader = {
  setting: {
    findMany(args: Prisma.SettingFindManyArgs): Promise<Array<{ key: string; value: Prisma.JsonValue }>>;
  };
};

export async function readReturnPolicySettings(client: SettingReader): Promise<ReturnPolicySettings> {
  const settings = await client.setting.findMany({
    where: { key: { in: Object.values(returnPolicySettingKeys) } },
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    returnWindowDays: boundedDays(
      readNumberSetting(values.get(returnPolicySettingKeys.returnWindowDays), defaultReturnPolicySettings.returnWindowDays),
    ),
    replacementWindowDays: boundedDays(
      readNumberSetting(
        values.get(returnPolicySettingKeys.replacementWindowDays),
        defaultReturnPolicySettings.replacementWindowDays,
      ),
    ),
  };
}

export function normalizeReturnPolicySettings(input: Partial<ReturnPolicySettings>): ReturnPolicySettings {
  return {
    returnWindowDays: boundedDays(input.returnWindowDays ?? defaultReturnPolicySettings.returnWindowDays),
    replacementWindowDays: boundedDays(
      input.replacementWindowDays ?? defaultReturnPolicySettings.replacementWindowDays,
    ),
  };
}

export function returnWindowDaysForResolution(
  settings: ReturnPolicySettings,
  resolution: "REFUND" | "REPLACEMENT",
) {
  return resolution === "REPLACEMENT" ? settings.replacementWindowDays : settings.returnWindowDays;
}

export function returnDeadline(deliveredAt: Date, windowDays: number) {
  return new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000);
}

function boundedDays(value: number) {
  return Math.min(365, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}
