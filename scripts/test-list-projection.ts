import { listJobsPage } from "@/src/services/jobs/page-query";

async function main() {
  const result = await listJobsPage({ limit: 2, status: "open" });
  const job = result.data[0];
  if (!job) {
    console.log("no jobs");
    return;
  }
  console.log("keys:", Object.keys(job).sort().join(", "));
  console.log("has searchText:", "searchText" in job);
  console.log("has description:", "description" in job);
  console.log("has embedding:", "embedding" in job);
  console.log("first item size (bytes):", JSON.stringify(job).length);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
