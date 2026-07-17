import { spawn, ChildProcess } from 'child_process';

/**
 * ngrok tunnel helper for the F005 smoke test.
 *
 * HTTPS (a secure context) is required for the camera (getUserMedia); the app is
 * exposed publicly via `ngrok http 4200 --host-header=rewrite` (see
 * tools/expose.sh). This helper spawns that tunnel, reads the public https URL
 * from ngrok's local inspection API, and hands back a stop() for teardown.
 *
 * ngrok's free tier only allows one agent session at a time, so if a tunnel is
 * already up (e.g. a manual `tools/expose.sh`), we reuse it and leave it running.
 */
const NGROK_API = 'http://127.0.0.1:4040/api/tunnels';

interface NgrokTunnelsResponse {
  tunnels?: { public_url: string; proto: string }[];
}

async function readHttpsUrl(): Promise<string | null> {
  try {
    const res = await fetch(NGROK_API);
    if (!res.ok) return null;
    const data = (await res.json()) as NgrokTunnelsResponse;
    const https = data.tunnels?.find((t) => t.public_url.startsWith('https://'));
    return https?.public_url ?? null;
  } catch {
    return null;
  }
}

export interface Tunnel {
  url: string;
  stop: () => Promise<void>;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start (or reuse) an ngrok HTTPS tunnel to the given local port. */
export async function startTunnel(port = 4200, timeoutMs = 25_000): Promise<Tunnel> {
  // Reuse an already-running tunnel rather than fighting the 1-session limit.
  const existing = await readHttpsUrl();
  if (existing) return { url: existing, stop: async () => {} };

  const proc: ChildProcess = spawn(
    'ngrok',
    ['http', String(port), '--host-header=rewrite', '--log=stdout'],
    { stdio: 'ignore' },
  );

  const deadline = Date.now() + timeoutMs;
  let url: string | null = null;
  while (Date.now() < deadline) {
    url = await readHttpsUrl();
    if (url) break;
    await delay(500);
  }

  if (!url) {
    proc.kill('SIGTERM');
    throw new Error(`ngrok tunnel did not come up within ${timeoutMs}ms`);
  }

  return {
    url,
    stop: async () => {
      proc.kill('SIGTERM');
      await delay(300);
    },
  };
}
