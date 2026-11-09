import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { LiveResults, type PublicResults } from "./live-results";

vi.mock("./use-realtime", () => ({ useRealtimeSignal: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
  getStatus: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status,
}));

const base: PublicResults = {
  event: {
    name: "Science Fair",
    code: "SF-1",
    status: "completed",
    subtitle: "Department: IT\nYear: 4",
  },
  sponsors: [
    { tier: "diamond", name: "Acme", logo_url: "http://localhost/a.png" },
    { tier: "supporter", name: "Helpers", logo_url: "http://localhost/b.png" },
  ],
  is_final: true,
  visibility: "rank_and_score",
  show_tie_indicator: true,
  revision: 1,
  published_at: "2026-11-01T10:00:00+00:00",
  rows: [
    {
      number: "1",
      name: "Alice",
      team_name: null,
      rank: 1,
      tied: false,
      score: "90.00",
    },
    {
      number: "2",
      name: "Bob",
      team_name: "Team B",
      rank: 2,
      tied: true,
      score: "85.00",
    },
    {
      number: "3",
      name: "Cara",
      team_name: null,
      rank: 2,
      tied: true,
      score: "85.00",
    },
  ],
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <LiveResults code="SF-1" />
    </QueryClientProvider>,
  );
}

describe("LiveResults", () => {
  beforeEach(() => vi.mocked(api.get).mockReset());

    it('shows the organization name and logo', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { ...base, organization: { name: 'Faculty of Engineering', logo_url: 'http://localhost/org.png' } } } })
    renderScreen()

    expect(await screen.findByText('Faculty of Engineering')).toBeInTheDocument()
    expect(screen.getByAltText('Faculty of Engineering')).toBeInTheDocument()
  })

  it('marks the preview and reads the preview endpoint', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: base } })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><LiveResults code="SF-1" preview={{ eventId: 5 }} /></QueryClientProvider>)

    expect(await screen.findByText('Preview. This is not public yet.')).toBeInTheDocument()
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/events/5/results/preview')
  })

  it("shows the final ranking with scores and tie indicators", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: base } });
    renderScreen();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Science Fair")).toBeInTheDocument();
    expect(screen.getByText("Final results")).toBeInTheDocument();
    expect(screen.getByText("90.00")).toBeInTheDocument();
    expect(screen.getAllByText("Tied")).toHaveLength(2);
  });

  it("hides the tie indicator when the policy says so", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { ...base, show_tie_indicator: false } },
    });
    renderScreen();

    await screen.findByText("Alice");
    expect(screen.queryByText("Tied")).not.toBeInTheDocument();
  });
  it("shows the subtitle lines and the sponsor groups", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: base } });
    renderScreen();

    expect(await screen.findByText("Department: IT")).toBeInTheDocument();
    expect(screen.getByText("Year: 4")).toBeInTheDocument();
    expect(screen.getByText("Diamond sponsor")).toBeInTheDocument();
    expect(screen.getByText("Supporter")).toBeInTheDocument();
    expect(screen.getByAltText("Acme")).toBeInTheDocument();
  });

  it("shows ordinal ranks and the participant number on each row", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: base } });
    renderScreen();

    await screen.findByText("Alice");
    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getAllByText("2nd")).toHaveLength(2);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows no scores for a rank-only publication", async () => {
    const rows = base.rows.map(({ score: _score, ...rest }) => rest);
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { ...base, visibility: "rank_only", rows } },
    });
    renderScreen();

    await screen.findByText("Alice");
    expect(screen.queryByText("90.00")).not.toBeInTheDocument();
  });

  it("explains that results are not published yet", async () => {
    vi.mocked(api.get).mockResolvedValue({ status: 404, data: {} });
    renderScreen();

    expect(
      await screen.findByText("Results are not published yet"),
    ).toBeInTheDocument();
  });
});
