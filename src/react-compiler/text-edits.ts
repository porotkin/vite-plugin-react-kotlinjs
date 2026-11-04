export interface TextEdit {
    start: number;
    end: number;
    text: string;
}

/**
 * Applies `edits` to `code[start, end)`; edits outside that range are ignored.
 * Overlaps: the edit starting first wins, on a tie the wider one, then the one listed first.
 */
export function applyEdits(code: string, edits: TextEdit[], start = 0, end = code.length): string {
    const inRange = edits
        .filter((edit) => edit.start >= start && edit.end <= end)
        .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    let out = '';
    let cursor = start;
    for (const edit of inRange) {
        if (edit.start < cursor) continue;
        out += code.slice(cursor, edit.start) + edit.text;
        cursor = edit.end;
    }
    return out + code.slice(cursor, end);
}
