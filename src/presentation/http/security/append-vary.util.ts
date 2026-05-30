export function appendVary(headers: Headers, value: string): void {
  const current = headers.get("vary");
  if (!current) {
    headers.set("vary", value);
    return;
  }

  const values = current.split(",").map((part) => part.trim().toLowerCase());
  if (!values.includes(value.toLowerCase())) {
    headers.set("vary", `${current}, ${value}`);
  }
}
