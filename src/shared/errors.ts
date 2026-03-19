export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ForbiddenError = (message: string) =>
  new AppError("FORBIDDEN", message);
