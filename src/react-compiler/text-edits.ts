import MagicString from 'magic-string';

export interface TextEdit {
    start: number;
    end: number;
    text: string;
}

/**
 * `code` with `edits` applied, as a `MagicString`: `toString()` is the result, `slice()` a rewritten range of it,
 * and it maps the result back to `code`. At an offset, inserts go first, in listed order. Overlapping replacements:
 * the one starting first wins, on a tie the wider one, then the one listed first.
 */
export function editSource(code: string, edits: TextEdit[]): MagicString {
    const width = (edit: TextEdit) => edit.end - edit.start;
    const source = new MagicString(code);
    let cursor = 0;
    for (const edit of [...edits].sort((a, b) => a.start - b.start || Number(width(a) > 0) - Number(width(b) > 0) || width(b) - width(a))) {
        if (edit.start < cursor) continue;
        cursor = edit.end;
        if (width(edit) === 0) source.appendLeft(edit.start, edit.text);
        else source.overwrite(edit.start, edit.end, edit.text);
    }
    return source;
}
