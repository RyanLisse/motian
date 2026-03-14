import type { Meta, StoryObj } from "@storybook/react";
import { ScoreRing } from "@/components/score-ring";

const meta: Meta<typeof ScoreRing> = {
  title: "Components/ScoreRing",
  component: ScoreRing,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Cirkelindicator voor match- of kwaliteitsscore (0–100). Kleur per band: groen ≥90, blauw ≥80, amber ≥70, rood <70. Gebruikt in matching en kandidaatkaarten.",
      },
    },
  },
  argTypes: {
    score: { control: { type: "range", min: 0, max: 100, step: 5 } },
    size: { control: "number" },
    strokeWidth: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof ScoreRing>;

export const Zero: Story = {
  args: { score: 0 },
};

export const Half: Story = {
  args: { score: 50 },
};

export const Good: Story = {
  args: { score: 75 },
};

export const High: Story = {
  args: { score: 92 },
};

export const Full: Story = {
  args: { score: 100 },
};

export const CustomSize: Story = {
  args: { score: 68, size: 80, strokeWidth: 6 },
};
