import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { LiveResults, type PublicResults } from './live-results'

vi.mock('./use-realtime', () => ({ useRealtimeSignal: vi.fn() }))
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  getStatus: (error: unknown) => (error as { response?: { status?: number } })?.response?.status,
}))

const base: PublicResults = {
  event: { name: 'Science Fair', code: 'SF-1', status: 'completed' },
  is_final: true,
  visibility: 'rank_and_score',
  show_tie_indicator: true,
  revision: 1,
  published_at: '2026-11-01T10:00:00+00:00',
  rows: [
    { number: '1', name: 'Alice', team_name: null, rank: 1, tied: false, score: '90.00' },
    { number: '2', name: 'Bob', team_name: 'Team B', rank: 2, tied: true, score: '85.00' },
    { number: '3', name: 'Cara', team_name: null, rank: 2, tied: true, score: '85.00' },
  ],
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><LiveResults code="SF-1" /></QueryClientProvider>)
}

describe('LiveResults', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('shows the final ranking with scores and tie indicators', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: base } })
    renderScreen()

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Science Fair')).toBeInTheDocument()
    expect(screen.getByText('Final results')).toBeInTheDocument()
    expect(screen.getByText('90.00')).toBeInTheDocument()
    expect(screen.getAllByText('Tied')).toHaveLength(2)
  })

  it('hides the tie indicator when the policy says so', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...base, show_tie_indicator: false } } })
    renderScreen()

    await screen.findByText('Alice')
    expect(screen.queryByText('Tied')).not.toBeInTheDocument()
  })

  it('shows no scores for a rank-only publication', async () => {
    const rows = base.rows.map(({ score: _score, ...rest }) => rest)
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...base, visibility: 'rank_only', rows } } })
    renderScreen()

    await screen.findByText('Alice')
    expect(screen.queryByText('90.00')).not.toBeInTheDocument()
  })

  it('explains that results are not published yet', async () => {
        vi.mocked(api.get).mockImplementation(async () => {
      throw Object.assign(new Error('Not found'), { response: { status: 404 } })
    })

    expect(await screen.findByText('Results are not published yet')).toBeInTheDocument()
  })
})