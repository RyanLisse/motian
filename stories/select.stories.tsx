"use client";

import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Dropdownselectie met trigger en opties. Gebruikt voor platform, status, contracttype en andere enums.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Kies een optie" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="striive">Striive</SelectItem>
        <SelectItem value="huxley">Huxley</SelectItem>
        <SelectItem value="computer-futures">Computer Futures</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithDefaultValue: Story = {
  render: () => (
    <Select defaultValue="huxley">
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Platform" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="striive">Striive</SelectItem>
        <SelectItem value="huxley">Huxley</SelectItem>
        <SelectItem value="computer-futures">Computer Futures</SelectItem>
      </SelectContent>
    </Select>
  ),
};
