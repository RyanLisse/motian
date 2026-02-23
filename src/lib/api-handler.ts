type ApiHandler<TArgs extends unknown[]> = (...args: TArgs) => Response | Promise<Response>;

type ApiHandlerOptions = {
  errorMessage?: string;
  status?: number;
  logPrefix?: string;
};

export function withApiHandler<TArgs extends unknown[]>(
  handler: ApiHandler<TArgs>,
  options: ApiHandlerOptions = {},
) {
  const {
    errorMessage = "Interne serverfout",
    status = 500,
    logPrefix = "API handler error",
  } = options;

  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(`${logPrefix}:`, error);
      return Response.json({ error: errorMessage }, { status });
    }
  };
}
