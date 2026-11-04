import { useEffect, useRef } from 'react'
import { getEcho } from '@/lib/realtime'

export type ConnectionState = 'connecting' | 'connected' | 'offline' | 'disabled'

const toState = (state: string): ConnectionState =>
  state === 'connected' ? 'connected' : state === 'connecting' || state === 'initialized' ? 'connecting' : 'offline'

/**
 * Calls onSignal whenever the server announces a change on the channel, and again after every (re)connect,
 * because messages sent while disconnected are lost. The payload is ignored: callers re-fetch from the API.
 */
export function useRealtimeSignal(
  channelName: string,
  eventName: string,
  isPrivate: boolean,
  onSignal: () => void,
  onState?: (state: ConnectionState) => void,
) {
  const signal = useRef(onSignal)
  const report = useRef(onState)

  useEffect(() => {
    signal.current = onSignal
    report.current = onState
  })

  useEffect(() => {
    const echo = getEcho()
    if (!echo) {
      report.current?.('disabled')
      return
    }

    const connection = echo.connector.pusher.connection
    const onStateChange = (change: { current: string }) => report.current?.(toState(change.current))
    const onConnected = () => signal.current()

    connection.bind('state_change', onStateChange)
    connection.bind('connected', onConnected)
    report.current?.(toState(connection.state))

    const channel = isPrivate ? echo.private(channelName) : echo.channel(channelName)
    channel.listen(`.${eventName}`, () => signal.current())

    return () => {
      connection.unbind('state_change', onStateChange)
      connection.unbind('connected', onConnected)
      echo.leave(channelName)
    }
  }, [channelName, eventName, isPrivate])
}