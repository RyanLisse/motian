import type { Meta, StoryObj } from "@storybook/react";
import { JobListItem } from "@/components/job-list-item";

const meta: Meta<typeof JobListItem> = {
  title: "Components/JobListItem",
  component: JobListItem,
  tags: ["autodocs"],
  argTypes: {
    isActive: { control: "boolean" },
    variant: { control: "select", options: ["compact", "card"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Lijstitem voor vacatures in de sidebar en op overzichtspagina’s.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof JobListItem>;

export const Active: Story = {
  args: {
    isActive: true,
    job: {
      id: "1",
      title: "Senior React Developer — Cloud Platform",
      company: "ING Bank",
      location: "Amsterdam",
      platform: "striive",
      workArrangement: "hybride",
      contractType: "freelance",
    },
  },
};

export const Inactive: Story = {
  args: {
    isActive: false,
    job: {
      id: "2",
      title: "Java Backend Engineer",
      company: "Rabobank",
      location: "Utrecht",
      platform: "huxley",
      workArrangement: "remote",
      contractType: "interim",
    },
  },
};

export const WithPipelineCount: Story = {
  args: {
    isActive: false,
    job: {
      id: "3",
      title: "Python Developer — ML Platform",
      company: "Booking.com",
      location: "Amsterdam",
      platform: "striive",
      workArrangement: "hybride",
      contractType: "freelance",
    },
    pipelineCount: 3,
  },
};

export const CardWithPipeline: Story = {
  args: {
    isActive: false,
    variant: "card",
    job: {
      id: "4",
      title: "Cloud Architect — AWS & Kubernetes",
      company: "ING Bank",
      location: "Amsterdam",
      platform: "huxley",
      workArrangement: "remote",
      contractType: "interim",
    },
    pipelineCount: 7,
  },
};
