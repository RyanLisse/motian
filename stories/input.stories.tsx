import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "@/components/ui/input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Tekstinvoerveld voor formulieren. Ondersteunt placeholder, disabled en type (text, email, etc.).",
      },
    },
  },
  argTypes: {
    type: { control: "select", options: ["text", "email", "password", "number"] },
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "Voer tekst in...", type: "text" },
};

export const WithValue: Story = {
  args: { defaultValue: "Bestaande waarde", type: "text" },
};

export const Disabled: Story = {
  args: { placeholder: "Uitgeschakeld veld", disabled: true, type: "text" },
};

export const Password: Story = {
  args: { placeholder: "Wachtwoord", type: "password" },
};
