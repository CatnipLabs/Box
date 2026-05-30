export function messageToText(message: unknown): string {
  if (message instanceof Error) {
    return message.message;
  }

  return String(message);
}
