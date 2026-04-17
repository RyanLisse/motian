export const MAIL_PROVIDER_VALUES = ["agentmail", "m365"] as const;

export type MailProviderValue = (typeof MAIL_PROVIDER_VALUES)[number];

export function resolveMailProvider(value: string | undefined): MailProviderValue {
  if (value === "m365") {
    return "m365";
  }

  return "agentmail";
}
