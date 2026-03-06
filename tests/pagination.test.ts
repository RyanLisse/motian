import { describe, expect, it } from "vitest";
import { parsePagination } from "../src/lib/pagination";

describe("parsePagination", () => {
  it("defaults to 50 results per pagina", () => {
    const params = new URLSearchParams();

    expect(parsePagination(params)).toEqual({
      page: 1,
      limit: 50,
      offset: 0,
    });
  });

  it("accepts perPage as alias for the limit", () => {
    const params = new URLSearchParams("pagina=3&perPage=25");

    expect(parsePagination(params)).toEqual({
      page: 3,
      limit: 25,
      offset: 50,
    });
  });
});
