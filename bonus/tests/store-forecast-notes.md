# Store forecast verification

Run the portable regression suite with:

    node --test bonus/tests/*.test.cjs

The forecast consumes the existing authenticated monthly store payload. It has no API writes, local storage, credentials, eligibility decisions, or new access permissions.

## Model and scope

- Compare the same configured store-manager competition groups, not the official total bonus.
- Baseline projected rate = actual / formal monthly target × days in month / baseline day.
- Next report projected rate = (actual + today's additions − today's reversals) / target × days in month / today's day.
- The report is expected tomorrow but covers today's cumulative units. Tomorrow's calendar day is NOT the denominator.
- Look up each group's manager tier with exact integer cross multiplication at 50/80/100/120/200%; then sum. Never look up a tier using rounded display percentages.
- Verify the baseline calculation against each imported rate within 0.000051 (the source reports four decimals). A mismatch or missing rate blocks a complete estimate.
- Explain the difference as time-only change plus scenario-input effect. The signed total can fall even when today's additions are positive.
- Preserve original actual/projected totals separately. Do not add the modeled difference to the original total or infer the unmodeled portion, ranking, eligibility, empty-handset amounts, or final payment.

## Required guards

The baseline must be yesterday in Taiwan, with a matching selected-store row date and matching month. A missing or provisional target, invalid count, missing price schedule, or incomplete input blocks the subtotal. Blank input is not zero. November 29 baseline + November 30 input is valid (report expected December 1); a November 30 baseline + December 1 input is not a November forecast.

Drafts are per store, in memory only. Reload/logout clears them. A changed date or base dataset resets them to avoid duplicate additions. Refresh of identical data preserves them. An in-flight data response cannot reopen a logged-out session.

## UI regression checklist

Reader/admin entry, explicit store selection, third-tab switching, positive and negative changes, multi-digit typing with retained focus, zero versus blank, excessive reversals, per-store isolation, clear, identical refresh, changed baseline, stale row, Taiwan midnight rollover, logout, and a delayed read resolving after logout. Confirm the existing rank/upload features still work and scenario input triggers no publish request. Inspect desktop and narrow-screen layouts; only the detailed table should scroll horizontally.
