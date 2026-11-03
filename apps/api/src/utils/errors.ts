import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({ message: error.message });
    return;
  }

  if (error?.name === "ZodError") {
    response.status(400).json({ message: "Invalid request data.", issues: error.issues });
    return;
  }

  if (error?.code === 11000) {
    response.status(409).json({ message: "A record with that value already exists." });
    return;
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    response.status(400).json({ message: "The supplied data is invalid." });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "An unexpected server error occurred." });
};
