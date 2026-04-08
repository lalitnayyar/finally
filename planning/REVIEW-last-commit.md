# Review Since Last Commit

Scope: reviewed the working tree against `HEAD`. The only tracked diff is [`planning/PLAN.md`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md); untracked helper/docs files are present but did not produce additional actionable findings.

## Findings

1. High: limiting the SSE stream to watchlist tickers will make held positions go stale as soon as a user removes a held symbol from the watchlist. [`planning/PLAN.md:181`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md#L181) says the server pushes updates for tickers in the `watchlist` table, but the UI still expects live portfolio valuation in the header, positions table, heatmap, and P&L views. Those components depend on current prices for open positions too, so the source set needs to be at least `watchlist ∪ held positions`, or the plan needs to forbid removing held symbols from the watchlist.

2. High: the new snapshot policy no longer supports the promised "portfolio value over time" chart. [`planning/PLAN.md:226`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md#L226), [`planning/PLAN.md:237`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md#L237), [`planning/PLAN.md:254`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md#L254), and [`planning/PLAN.md:363`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md#L363) reduce snapshot creation to startup plus trade execution, which means the history will stay flat during normal market movement between trades. That makes the P&L chart misleading for the common case where prices move but the user does nothing. The previous periodic snapshotting, or some other mark-to-market sampling strategy, is still needed.

3. Medium: treating upstream LLM failures as HTTP 200 hides real backend errors behind a success status. [`planning/PLAN.md:300`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md#L300) - [`planning/PLAN.md:304`](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md#L304) makes rate limits, network failures, and malformed provider responses indistinguishable from successful chat calls to clients, logs, and health monitors. If the product wants a friendly fallback message, keep that payload, but return a 5xx status or an explicit error flag so the frontend and observability can still detect degraded service.

No other actionable findings in the tracked diff.
