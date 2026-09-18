from __future__ import annotations

import re


def find_slop(text: str, banned: list[str]) -> list[str]:
    """Return the banned phrases present in text. Single tokens match on word boundaries;
    multi-word / hyphenated phrases match as substrings. Case-insensitive."""
    if not text:
        return []
    low = text.lower()
    hits: list[str] = []
    for phrase in banned:
        p = phrase.lower().strip()
        if not p:
            continue
        if " " in p or "-" in p:
            if p in low:
                hits.append(phrase)
        elif re.search(rf"\b{re.escape(p)}\b", low):
            hits.append(phrase)
    return hits


def is_clean(text: str, banned: list[str]) -> bool:
    return not find_slop(text, banned)
