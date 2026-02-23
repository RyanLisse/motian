import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "@/components/status-badge";

const meta: Meta<typeof StatusBadge> = {
  title: "Components/StatusBadge",
  component: StatusBadge,
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Success: Story = { args: { status: "success" } };
export const Partial: Story = { args: { status: "partial" } };
export const Failed: Story = { args: { status: "failed" } };
export const Gezond: Story = { args: { status: "gezond" } };
export const Waarschuwing: Story = { args: { status: "waarschuwing" } };
export const Kritiek: Story = { args: { status: "kritiek" } };
export const Inactief: Story = { args: { status: "inactief" } };
