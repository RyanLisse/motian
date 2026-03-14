import type { Meta, StoryObj } from "@storybook/react";
import { PageHeader } from "@/components/page-header";

const meta: Meta<typeof PageHeader> = {
  title: "Components/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
  },
  parameters: {
    docs: {
      description: {
        component: "Pagina-header met optionele titel, beschrijving en acties.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {
  args: { title: "Opdrachten" },
};

export const WithDescription: Story = {
  args: {
    title: "Opdrachten",
    description: "Beheer en bekijk alle beschikbare opdrachten",
  },
};

export const WithActions: Story = {
  args: {
    title: "Scraper configuraties",
    description: "Configureer en beheer uw scrapers",
  },
  render: (args) => (
    <PageHeader {...args}>
      <button
        type="button"
        className="px-4 py-2 text-sm bg-[#10a37f] text-white rounded-lg hover:bg-[#10a37f]/90"
      >
        Nieuwe configuratie
      </button>
    </PageHeader>
  ),
};
