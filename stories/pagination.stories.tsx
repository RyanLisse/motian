import type { Meta, StoryObj } from "@storybook/react";
import { Pagination } from "@/components/shared/pagination";

function buildHref(page: number) {
  return `?page=${page}`;
}

const meta: Meta<typeof Pagination> = {
  title: "Components/Pagination",
  component: Pagination,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Vorige/Volgende-paginering met pagina-indicator. Link-gebaseerd via buildHref. Verbergt zich bij totalPages <= 1.",
      },
    },
  },
  argTypes: {
    page: { control: "number" },
    totalPages: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const FirstPage: Story = {
  args: {
    page: 1,
    totalPages: 5,
    buildHref,
  },
};

export const MiddlePage: Story = {
  args: {
    page: 3,
    totalPages: 8,
    buildHref,
  },
};

export const LastPage: Story = {
  args: {
    page: 5,
    totalPages: 5,
    buildHref,
  },
};
