import type { Meta, StoryObj } from "@storybook/react";
import { FilterTabs } from "@/components/shared/filter-tabs";

const defaultOptions = [
  { value: "all", label: "Alle" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Gesloten" },
];

const meta: Meta<typeof FilterTabs> = {
  title: "Components/FilterTabs",
  component: FilterTabs,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Tabbladen voor filterkeuze (bijv. open/gesloten). Link-gebaseerd met buildHref. Varianten: pill (solid) en subtle.",
      },
    },
  },
  argTypes: {
    activeValue: { control: "select", options: ["all", "open", "closed"] },
    variant: { control: "select", options: ["pill", "subtle"] },
  },
};

export default meta;
type Story = StoryObj<typeof FilterTabs>;

function buildHref(value: string) {
  return `/vacatures?status=${value}`;
}

export const Default: Story = {
  args: {
    options: defaultOptions,
    activeValue: "all",
    buildHref,
  },
};

export const OneSelected: Story = {
  args: {
    options: defaultOptions,
    activeValue: "open",
    buildHref,
  },
};

export const Subtle: Story = {
  args: {
    options: defaultOptions,
    activeValue: "closed",
    buildHref,
    variant: "subtle",
  },
};
