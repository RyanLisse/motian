import type { Meta, StoryObj } from "@storybook/react";
import { JobCard } from "@/components/job-card";

const meta: Meta<typeof JobCard> = {
  title: "Components/JobCard",
  component: JobCard,
};

export default meta;
type Story = StoryObj<typeof JobCard>;

export const FullData: Story = {
  args: {
    job: {
      id: "1",
      title: "Senior React Developer — Cloud Platform",
      company: "ING Bank",
      location: "Amsterdam",
      platform: "striive",
      contractType: "freelance",
      workArrangement: "hybride",
      rateMin: 85,
      rateMax: 110,
      applicationDeadline: new Date("2026-03-15"),
      postedAt: new Date("2026-02-20"),
    },
  },
};

export const MinimalData: Story = {
  args: {
    job: {
      id: "2",
      title: "Java Backend Engineer",
      company: null,
      location: null,
      platform: "huxley",
      contractType: null,
      workArrangement: null,
      rateMin: null,
      rateMax: null,
      applicationDeadline: null,
      postedAt: new Date("2026-02-18"),
    },
  },
};

export const RemoteBadge: Story = {
  args: {
    job: {
      id: "3",
      title: "DevOps Engineer — Kubernetes & Terraform",
      company: "Rabobank",
      location: "Utrecht",
      platform: "computer-futures",
      contractType: "interim",
      workArrangement: "remote",
      rateMin: null,
      rateMax: 95,
      applicationDeadline: new Date("2026-04-01"),
      postedAt: new Date("2026-02-22"),
    },
  },
};

export const WithPipelineCount: Story = {
  args: {
    job: {
      id: "4",
      title: "Senior Data Engineer — Azure & Databricks",
      company: "ABN AMRO",
      location: "Amsterdam",
      platform: "striive",
      contractType: "freelance",
      workArrangement: "hybride",
      rateMin: 90,
      rateMax: 120,
      applicationDeadline: new Date("2026-03-20"),
      postedAt: new Date("2026-02-25"),
    },
    pipelineCount: 5,
  },
};
