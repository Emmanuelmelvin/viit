function getTimezoneOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hours = Math.floor(Math.abs(offset) / 60).toString().padStart(2, "0");
  const minutes = (Math.abs(offset) % 60).toString().padStart(2, "0");

  return `${sign}${hours}${minutes}`;
}

export function getIdentity(): string {
  const name = process.env.VIIT_AUTHOR_NAME ?? "Viit User";
  const email = process.env.VIIT_AUTHOR_EMAIL ?? "viit@example.com";
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);

  return `${name} <${email}> ${timestamp} ${getTimezoneOffset(now)}`;
}
