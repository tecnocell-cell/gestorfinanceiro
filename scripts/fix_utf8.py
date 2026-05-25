# -*- coding: utf-8 -*-
"""Corrige mojibake (UTF-8 mal interpretado) em arquivos do projeto."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _m(*bytes_: int) -> str:
    """Bytes UTF-8 exibidos erroneamente como Latin-1."""
    return bytes(bytes_).decode("latin-1")


# Mapa: sequencia corrompida -> caractere correto
MOJIBAKE_MAP: list[tuple[str, str]] = [
    (_m(0xC3, 0xA1), "á"),
    (_m(0xC3, 0xA0), "à"),
    (_m(0xC3, 0xA2), "â"),
    (_m(0xC3, 0xA3), "ã"),
    (_m(0xC3, 0xA7), "ç"),
    (_m(0xC3, 0xA9), "é"),
    (_m(0xC3, 0xAA), "ê"),
    (_m(0xC3, 0xAD), "í"),
    (_m(0xC3, 0xB3), "ó"),
    (_m(0xC3, 0xB4), "ô"),
    (_m(0xC3, 0xB5), "õ"),
    (_m(0xC3, 0xBA), "ú"),
    (_m(0xC3, 0x8D), "Í"),
    (_m(0xC3, 0x89), "É"),
    (_m(0xC3, 0x81), "Á"),
    (_m(0xC3, 0x93), "Ó"),
    (_m(0xC3, 0x9A), "Ú"),
    (_m(0xC3, 0x97), "×"),
    (_m(0xE2, 0x80, 0x94), "—"),
    (_m(0xE2, 0x80, 0x93), "–"),
    (_m(0xE2, 0x80, 0xA6), "…"),
    (_m(0xE2, 0x88, 0x92), "−"),
    (_m(0xC3, 0xA2, 0xCB, 0x86, 0xE2, 0x80, 0x99), "−"),  # minus corrompido (âˆ')
    (_m(0xE2, 0x9C, 0x8E), "✎"),
    (_m(0xE2, 0x9C, 0x95), "✕"),
    (_m(0xE2, 0x8C, 0x95), "⌕"),
    (_m(0xC2, 0xA0), " "),
]

SCAN_GLOBS = [
    "src/**/*.jsx",
    "src/**/*.js",
    "src/**/*.css",
    "docs/**/*.md",
    "server/**/*.js",
]

MARKERS = ("\xc3", "\xe2", "\xc2")  # inicio tipico de mojibake UTF-8


def fix_text(text: str) -> tuple[str, int]:
    changes = 0
    for bad, good in MOJIBAKE_MAP:
        n = text.count(bad)
        if n:
            text = text.replace(bad, good)
            changes += n

    if "<motion" in text or "</motion>" in text:
        n = text.count("<motion") + text.count("</motion>")
        text = text.replace("<motion", "<div").replace("</motion>", "</div>")
        changes += n

    return text, changes


def needs_fix(text: str) -> bool:
    if "<motion" in text or "</motion>" in text:
        return True
    for bad, _ in MOJIBAKE_MAP:
        if bad in text:
            return True
    return False


def scan_file(path: Path) -> tuple[bool, int]:
    text = path.read_text(encoding="utf-8")
    if not needs_fix(text):
        return False, 0
    fixed, n = fix_text(text)
    if fixed == text:
        return False, 0
    path.write_text(fixed, encoding="utf-8", newline="\n")
    return True, n


def main() -> int:
    total_files = 0
    total_changes = 0
    for pattern in SCAN_GLOBS:
        for path in sorted(ROOT.glob(pattern)):
            if not path.is_file():
                continue
            changed, n = scan_file(path)
            if changed:
                total_files += 1
                total_changes += n
                print(f"  {path.relative_to(ROOT)} ({n})")
    print(f"\nTotal: {total_files} arquivo(s), ~{total_changes} correcoes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
