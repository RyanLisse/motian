import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "@/components/ui/badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Klein label voor status, tags of tellingen. Varianten: default, secondary, destructive, outline.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: "Actief", variant: "default" },
};

export const Secondary: Story = {
  args: { children: "Concept", variant: "secondary" },
};

export const Destructive: Story = {
  args: { children: "Afgewezen", variant: "destructive" },
};

export const Outline: Story = {
  args: { children: "Optioneel", variant: "outline" },
};
