import type { Meta, StoryObj } from "@storybook/react";
import { BarChart3Icon } from "lucide-react";
import { KPICard } from "@/components/shared/kpi-card";

const meta: Meta<typeof KPICard> = {
  title: "Components/KPICard",
  component: KPICard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "KPI-kaart voor dashboards: icoon, label en waarde. Optioneel compact, tooltip en link. Gebruikt op overzicht en scraper-pagina's.",
      },
    },
  },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    compact: { control: "boolean" },
    title: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof KPICard>;

export const Default: Story = {
  args: {
    icon: <BarChart3Icon className="size-4" />,
    label: "Actieve vacatures",
    value: 42,
  },
};

export const WithTrend: Story = {
  args: {
    icon: <BarChart3Icon className="size-4" />,
    label: "Nieuwe deze week",
    value: "12",
    valueClassName: "text-green-600",
  },
};

export const Compact: Story = {
  args: {
    icon: <BarChart3Icon className="size-3" />,
    label: "Matches",
    value: 8,
    compact: true,
  },
};

export const WithTooltip: Story = {
  args: {
    icon: <BarChart3Icon className="size-4" />,
    label: "Totaal runs",
    value: 156,
    title: "Aantal scraper-runs in de afgelopen 30 dagen",
  },
};
