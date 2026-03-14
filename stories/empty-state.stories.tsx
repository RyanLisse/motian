import type { Meta, StoryObj } from "@storybook/react";
import { InboxIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Lege staat wanneer er geen resultaten zijn. Titel verplicht; optioneel subtitel en icoon. Gebruikt bij lege filters, geen vacatures, geen kandidaten.",
      },
    },
  },
  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const TitleOnly: Story = {
  args: {
    title: "Geen vacatures gevonden",
  },
};

export const WithSubtitle: Story = {
  args: {
    title: "Geen resultaten",
    subtitle: "Pas de filters aan of voeg een nieuwe vacature toe.",
  },
};

export const WithIcon: Story = {
  args: {
    icon: <InboxIcon className="size-12 text-muted-foreground" />,
    title: "Nog geen kandidaten",
    subtitle: "Koppel kandidaten via de matching-pagina.",
  },
};
