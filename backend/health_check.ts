export async function runHealthCheck(port: number) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    Deno.exit(response.ok ? 0 : 1);
  } catch {
    Deno.exit(1);
  }
}
