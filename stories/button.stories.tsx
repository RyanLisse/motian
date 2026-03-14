import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Primaire knop met CVA-varianten en groottes. Gebruikt in formulieren, actiebalken en navigatie.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Opslaan", variant: "default", size: "default" },
};

export const Destructive: Story = {
  args: { children: "Verwijderen", variant: "destructive", size: "default" },
};

export const Outline: Story = {
  args: { children: "Annuleren", variant: "outline", size: "default" },
};

export const Small: Story = {
  args: { children: "Klein", variant: "default", size: "sm" },
};

export const Large: Story = {
  args: { children: "Groot", variant: "default", size: "lg" },
};

export const Disabled: Story = {
  args: { children: "Uitgeschakeld", variant: "default", size: "default", disabled: true },
};
