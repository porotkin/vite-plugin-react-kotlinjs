export interface TextEdit {
    start: number;
    end: number;
    text: string;
}

/**
 * Applies `edits` to `code[start, end)`; edits outside that range are ignored.
 * At an offset, inserts go first, in listed order. Overlapping replacements: the one starting first wins,
 * on a tie the wider one, then the one listed first.
 */
export function applyEdits(code: string, edits: TextEdit[], start = 0, end = code.length): string {
    const width = (edit: TextEdit) => edit.end - edit.start;
    const inRange = edits
        .filter((edit) => edit.start >= start && edit.end <= end)
        .sort((a, b) => a.start - b.start || Number(width(a) > 0) - Number(width(b) > 0) || width(b) - width(a));
    let out = '';
    let cursor = start;
    for (const edit of inRange) {
        if (edit.start < cursor) continue;
        out += code.slice(cursor, edit.start) + edit.text;
        cursor = edit.end;
    }
    return out + code.slice(cursor, end);
}
