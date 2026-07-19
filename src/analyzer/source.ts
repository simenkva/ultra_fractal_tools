import type { SourcePosition, SourceRange } from "./types";

export interface PhysicalLine {
  readonly number: number;
  readonly startOffset: number;
  readonly text: string;
  readonly newline: string;
}

export class SourceMap {
  public readonly lines: readonly PhysicalLine[];
  private readonly lineStarts: readonly number[];

  public constructor(public readonly source: string) {
    const lines: PhysicalLine[] = [];
    const starts: number[] = [];
    let offset = 0;
    let lineNumber = 0;

    while (offset < source.length) {
      starts.push(offset);
      let end = offset;
      while (end < source.length && source[end] !== "\r" && source[end] !== "\n") {
        end += 1;
      }

      let newline = "";
      if (
        source[end] === "\r" &&
        source[end + 1] === "\r" &&
        source[end + 2] === "\n"
      ) {
        newline = "\r\r\n";
      } else if (source[end] === "\r" && source[end + 1] === "\n") {
        newline = "\r\n";
      } else if (source[end] === "\r" || source[end] === "\n") {
        newline = source[end] ?? "";
      }

      lines.push({
        number: lineNumber,
        startOffset: offset,
        text: source.slice(offset, end),
        newline,
      });
      offset = end + newline.length;
      lineNumber += 1;
    }

    if (source.length === 0 || offset === source.length) {
      const last = lines.at(-1);
      if (last === undefined || last.newline.length > 0) {
        starts.push(source.length);
        lines.push({
          number: lineNumber,
          startOffset: source.length,
          text: "",
          newline: "",
        });
      }
    }

    this.lines = lines;
    this.lineStarts = starts;
  }

  public positionAt(requestedOffset: number): SourcePosition {
    const offset = Math.max(0, Math.min(requestedOffset, this.source.length));
    let low = 0;
    let high = this.lineStarts.length - 1;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const start = this.lineStarts[middle] ?? 0;
      const next = this.lineStarts[middle + 1] ?? Number.POSITIVE_INFINITY;
      if (offset < start) {
        high = middle - 1;
      } else if (offset >= next) {
        low = middle + 1;
      } else {
        return { offset, line: middle, character: offset - start };
      }
    }

    const line = Math.max(0, this.lineStarts.length - 1);
    const start = this.lineStarts[line] ?? 0;
    return { offset, line, character: offset - start };
  }

  public range(startOffset: number, endOffset: number): SourceRange {
    return {
      start: this.positionAt(startOffset),
      end: this.positionAt(endOffset),
    };
  }
}
