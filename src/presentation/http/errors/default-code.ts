export function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return "bad_request";
    case 404:
      return "not_found";
    case 405:
      return "method_not_allowed";
    case 413:
      return "payload_too_large";
    case 500:
      return "internal_server_error";
    default:
      return "http_error";
  }
}
