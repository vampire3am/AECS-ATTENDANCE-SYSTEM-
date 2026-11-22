export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function invariant(value: unknown, message: string, status = 400): asserts value {
  if (!value) throw new AppError(message, status);
}
