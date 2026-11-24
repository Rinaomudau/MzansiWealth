# Wealth Planner ZA

A personal finance planner in **plain JavaScript** (no frameworks, no libraries, no build step, no network requests), working in **South African rand**. Based on the structure of The Wealth Project.

## New in 1.1: Stacy and an African-inspired look

**Ask Stacy** is an assistant that runs entirely on your device (no cloud model, no API key, no network). It is built from three parts in `js/ai.js`:

1. **A sentence parser** that turns plain English into changes. Try "What if I retire at 60?", "What if I save R3 000 a month?", "What if I work 3 years longer?", "What if I get a 10% raise?" or "What if I invest everything?". Several changes in one sentence work too.
2. **A topic matcher** that answers questions about your score, retirement odds, debt, budget, emergency fund, goals and SA tax, always using your own numbers.
3. **A coach** that runs six candidate changes through the same 500-scenario simulation, ranks them by how much they raise your chance of not running out of money, and flags weak spots (thin cash buffer, expensive debt, no employer contribution).

Every what-if answer comes from the real simulation, not a canned reply, and a **Test this in What if** button carries the change straight to the What if screen. Stacy is honest about its limits: it says it is not a cloud AI and not a licensed adviser, and it declines to recommend specific products. Typed text is only ever inserted as plain text.

**Design:** earthy terracotta, ochre, lagoon teal and savanna green; Ndebele-style triangle borders; a kente-style stripe under headings; a subtle diamond pattern in the background. All patterns are inline SVG/CSS, so the app still works offline with no image files.

## Run it

Unzip and double-click `index.html`. That's it. It works offline.

To run the tests (Node 14+, no installs): `node test/run.js`

## What it does

| Screen | What you get |
| --- | --- |
| Overview | Wealth score out of 100, plain-language insights, key numbers |
| Ask Stacy | On-device assistant: coach summary, health flags, ranked best moves, and a chat that answers questions and tests "what if" sentences |
| Tell us about you | Age, retirement age, monthly income, savings, employer contribution, debt |
| Savings and expenses | Needs vs wants sliders, 13 expense categories |
| How you compare | Your split against peer averages, biggest gaps and what closing them is worth |
| What if | 500 simulated markets, a fan chart of outcomes, a what-if mode and a ranked list of what helps most |
| Pick your goals | Emergency fund, debt-free, home deposit, education, car, trip, with the monthly cost of each |
| Action plan | A checklist built from your numbers, with SA tax tips, saved on your device |

Everything is stored in your browser's `localStorage`. Nothing leaves your device.

## Project layout

```
index.html            page structure
css/styles.css        styles (system fonts only)
js/helpers.js         DOM shortcuts, rand formatting
js/data.js            constants, South African rules, defaults  <- edit numbers here
js/model.js           state, simulation, goals, action plan     (no DOM access)
js/ai.js              Stacy: parser, coach, question answering   (no DOM access)
js/view.js            all drawing
js/controller.js      events, routing, refresh
test/run.js           Node tests for the maths
```

The scripts are classic `<script>` tags that share one global scope, loaded in the order above. This is deliberate: ES modules don't load from `file://`, and this way the app opens with a double-click.

## South African assumptions (SARS 2026/27 tax year)

Set in `js/data.js`. Check them against current rules before relying on them.

- Tax-free savings account: R46 000 a year, R500 000 lifetime, 40% penalty on excess.
- Retirement fund contributions: deductible up to 27.5% of income, capped at R430 000 a year.
- State old-age grant: R2 400 a month, means-tested (default "other retirement income" is R0).
- Default inflation 5% (Stats SA CPI was 5.2% in October 2026).
- Investment returns (nominal): no risk 7%, moderate 9%, high risk 11% a year, with different volatility. These are planning assumptions, not forecasts.
- Peer averages are illustrative, not official statistics.

## How the projection works

All results are in today's rand. Each of 500 simulated paths grows your savings by a random yearly return (based on your investment style and inflation), adds your savings plus your employer's contribution until you retire, then draws down your retirement spending (a % of today's spending, less other retirement income) until your plan age. "Chance savings last" is the share of paths that still have money at the end. The random draws are seeded, so the chart stays steady while you move sliders.

## Not financial advice

Educational estimates only. Speak to an authorised financial services provider before making major decisions.
