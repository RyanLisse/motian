import type { Meta, StoryObj } from "@storybook/react";
import { OpdrachtenFilters } from "@/app/opdrachten/filters";

const meta: Meta<typeof OpdrachtenFilters> = {
  title: "Components/OpdrachtenFilters",
  component: OpdrachtenFilters,
};

export default meta;
type Story = StoryObj<typeof OpdrachtenFilters>;

export const Default: Story = {
  args: {
    query: "",
    platform: "",
    platforms: ["striive", "huxley", "computer-futures"],
    provincie: "",
    tariefMin: "",
    tariefMax: "",
    contractType: "",
    page: 1,
    totalPages: 5,
  },
};

export const WithActiveFilters: Story = {
  args: {
    query: "React developer",
    platform: "striive",
    platforms: ["striive", "huxley", "computer-futures"],
    provincie: "Noord-Holland",
    tariefMin: "80",
    tariefMax: "120",
    contractType: "freelance",
    page: 2,
    totalPages: 8,
  },
};
