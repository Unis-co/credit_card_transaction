export interface ErrorHandlerOptions {
  genericMessage: string
  fallbackMessage?: string
}

export function formatErrorMessage(error: any, options: ErrorHandlerOptions): string {
  const { genericMessage, fallbackMessage = "An unexpected error occurred. Please try again." } = options

  let specificMessage = ""

  // Extract specific error message from various formats
  if (error?.error?.message) {
    // Standardized format: { error: { message: "...", code: "..." } }
    specificMessage = error.error.message
  } else if (error?.message) {
    // Direct message format: { message: "..." }
    specificMessage = error.message
  } else if (error?.error && typeof error.error === "string") {
    // String error format: { error: "..." }
    specificMessage = error.error
  } else if (typeof error === "string") {
    // Direct string error
    specificMessage = error
  } else {
    // Fallback for unknown error formats
    specificMessage = fallbackMessage
  }

  // Combine generic message with specific message
  return `${genericMessage} ${specificMessage}`
}

export function getErrorCode(error: any): string | undefined {
  return error?.error?.code || error?.code
}
