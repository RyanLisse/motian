import { type NextRequest, NextResponse } from "next/server";
import { forwardBffToApi, isFirstPartyBrowserRequest, resolveBffApiPath } from "@/src/lib/bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: NextRequest, path: string[] | undefined): Promise<Response> {
  if (!isFirstPartyBrowserRequest(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const apiPath = resolveBffApiPath(path ?? []);
  if (!apiPath) {
    return NextResponse.json({ error: "Ongeldig pad" }, { status: 400 });
  }

  return forwardBffToApi(request, apiPath);
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function dispatch(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return handle(request, path);
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
export const HEAD = dispatch;
