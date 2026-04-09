import { tool } from "ai";
import {
  generateInterviewPrep,
  interviewPrepGeneratorInputSchema,
} from "@/src/services/interview-prep-generator";

export const genereerInterviewPrep = tool({
  description:
    "Genereer interviewvoorbereiding voor recruiters, zoals screeningvragen, scorecriteria en recruiter-notes. Gebruik deze tool pas nadat je eerst 3-5 verduidelijkende vragen hebt gesteld. Als cruciale context ontbreekt, retourneert de tool verduidelijkingsvragen in plaats van direct een prep pakket.",
  inputSchema: interviewPrepGeneratorInputSchema,
  execute: async (input) => {
    return generateInterviewPrep(input);
  },
});
