from __future__ import annotations

from .audit import Diagnostics


def render_report(diag: Diagnostics, deadline_warnings: list[str], live: bool) -> str:
    mode = "LIVE" if live else "DRY-RUN (fixtures)"
    lines: list[str] = []
    lines.append("# ACCOUNT HEALTH DIAGNOSTIC REPORT")
    lines.append("")
    lines.append(f"- Mode: **{mode}**")
    lines.append(f"- Window: {diag.window[0]} -> {diag.window[1]} ({diag.lookback_days}d)")
    lines.append(f"- Prior window: {diag.prior_window[0]} -> {diag.prior_window[1]}")
    lines.append(
        f"- Flags: {len(diag.fatigued)} fatigued / {len(diag.bleeding)} bleeding / {len(diag.fragmented)} fragmented"
    )
    lines.append("")

    if deadline_warnings:
        lines.append("## API deprecation deadlines")
        for warning in deadline_warnings:
            lines.append(f"- {warning}")
        lines.append("")

    lines.append("## Fatigued ads (frequency > threshold AND link-CTR decline > threshold)")
    if diag.fatigued:
        lines.append("| Ad | Ad Set | Freq | CTR now | CTR prev | Decline | Spend | CPA |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for a in diag.fatigued:
            lines.append(
                f"| {a.ad_name} | {a.adset_name} | {a.frequency:.2f} | {a.ctr:.2f}% | "
                f"{a.ctr_prev:.2f}% | {a.ctr_decline_pct:.1f}% | ${a.spend:.0f} | "
                f"{('$' + format(a.cpa, '.2f')) if a.cpa else 'n/a'} |"
            )
    else:
        lines.append("_None._")
    lines.append("")

    lines.append("## Bleeding ad sets (spend > multiple x target CPA AND zero conversions)")
    if diag.bleeding:
        lines.append("| Ad Set | Campaign | Spend | Conversions |")
        lines.append("|---|---|---|---|")
        for s in diag.bleeding:
            lines.append(f"| {s.adset_name} | {s.campaign_name} | ${s.spend:.0f} | {s.conversions:.0f} |")
    else:
        lines.append("_None._")
    lines.append("")

    lines.append("## Fragmented campaigns (many ad sets, no campaign budget optimization)")
    if diag.fragmented:
        lines.append("| Campaign | Ad sets | CBO |")
        lines.append("|---|---|---|")
        for c in diag.fragmented:
            lines.append(f"| {c.campaign_name} | {c.adset_count} | {'yes' if c.uses_cbo else 'no'} |")
    else:
        lines.append("_None._")
    lines.append("")

    return "\n".join(lines)
