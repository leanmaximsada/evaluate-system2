import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { api } from '@/lib/api'

export interface RealtimeChannel {
  listen(event: string, callback: (payload: unknown) => void): RealtimeChannel
}

interface PusherConnection {
  state: string
  bind(event: string, callback: (...args: never[]) => void): void
  unbind(event: string, callback?: (...args: never[]) => void): void
}

export interface RealtimeClient {
  channel(name: string): RealtimeChannel
  private(name: string): RealtimeChannel
  leave(name: string): void
  connector: { pusher: { connection: PusherConnection } }
}

let instance: RealtimeClient | null = null

/** One shared connection per browser tab. Returns null on the server or when Reverb is not configured. */
export function getEcho(): RealtimeClient | null {
  if (typeof window === 'undefined') return null

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY
  if (!key) return null

  if (!instance) {
    ;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher
    const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080)

    instance = new Echo({
      broadcaster: 'reverb',
      key,
      wsHost: process.env.NEXT_PUBLIC_REVERB_HOST ?? 'localhost',
      wsPort: port,
      wssPort: port,
      forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
      // Private channels are authorised through our own API client, so the session cookie and CSRF token are used.
      authorizer: (channel: { name: string }) => ({
        authorize: (socketId: string, callback: (error: Error | null, data: unknown) => void) => {
          api
            .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
            .then((response) => callback(null, response.data))
            .catch((error) => callback(error as Error, null))
        },
      }),
    } as never) as unknown as RealtimeClient
  }

  return instance
}