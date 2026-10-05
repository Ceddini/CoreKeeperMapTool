/**
 * Streaming scanner for Core Keeper map files after decompression:
 *
 *   {"mapParts":{"keys":[{"x":-1,"y":-1},…],"values":[{"png":[137,80,…],"timestampPng":[…]},…]}}
 *
 * JSON.parse on these files is slow and memory hungry because every PNG byte is a JSON number.
 * This scanner reads the bytes directly into Uint8Arrays, skips everything it does not need
 * (including `timestampPng`), and can be fed arbitrary chunk boundaries.
 */

export class ScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScanError';
  }
}

export interface ScannerCallbacks {
  key(index: number, x: number, y: number): void;
  /**
   * `png` is null when the part has no image. `ts` is the part's exploration-time image, if any.
   * `hash` is FNV-1a over both byte arrays (changes whenever either changes).
   */
  part(index: number, png: Uint8Array | null, hash: number, ts: Uint8Array | null): void;
}

const S = {
  RootOpen: 0,
  RootKey: 1,
  MapPartsKey: 2,
  KeysItem: 3,
  KeyItemKey: 4,
  ValuesItem: 5,
  ValueItemKey: 6,
  Done: 7,
} as const;
type S = (typeof S)[keyof typeof S];

const Sub = {
  None: 0,
  Colon: 1,
  Value: 2,
  After: 3,
  Bytes: 4,
  Skip: 5,
} as const;
type Sub = (typeof Sub)[keyof typeof Sub];

const C_QUOTE = 34,
  C_COMMA = 44,
  C_COLON = 58,
  C_LBRACE = 123,
  C_RBRACE = 125,
  C_LBRACK = 91,
  C_RBRACK = 93,
  C_BACKSLASH = 92,
  C_MINUS = 45,
  C_ZERO = 48,
  C_NINE = 57;

function isWs(c: number): boolean {
  return c === 32 || c === 10 || c === 13 || c === 9;
}

export class MapPartsScanner {
  private state: S = S.RootOpen;
  private sub: Sub = Sub.None;
  private pendingKey = '';
  private carry: Uint8Array | null = null;

  // Key item being built.
  private keyX = 0;
  private keyY = 0;
  private keyIndex = 0;

  // Value item being built.
  private valueIndex = 0;
  private png: Uint8Array | null = null;
  private ts: Uint8Array | null = null;
  private partHash = 0;
  /** Byte array currently being read, and where it goes when complete. */
  private bytes: Uint8Array = new Uint8Array(0);
  private bytesLen = 0;
  private bytesTarget: 'png' | 'ts' = 'png';
  private acc = 0;
  private hasDigit = false;

  // Skip state.
  private skipDepth = 0;
  private skipInString = false;
  private skipEscape = false;
  private skipScalar = false;

  private readonly cb: ScannerCallbacks;

  constructor(cb: ScannerCallbacks) {
    this.cb = cb;
  }

  get partsSeen(): number {
    return this.valueIndex;
  }

  push(input: Uint8Array): void {
    let buf = input;
    if (this.carry) {
      buf = new Uint8Array(this.carry.length + input.length);
      buf.set(this.carry);
      buf.set(input, this.carry.length);
      this.carry = null;
    }
    const consumed = this.run(buf);
    if (consumed < buf.length) this.carry = buf.slice(consumed);
  }

  end(): void {
    if (this.carry) this.run(this.carry, true);
    if (this.state !== S.Done) throw new ScanError('Unexpected end of map data');
  }

  /** Returns how many bytes were consumed; the rest is an incomplete token to carry over. */
  private run(buf: Uint8Array, final = false): number {
    const n = buf.length;
    let i = 0;
    while (i < n) {
      // Hot paths first.
      if (this.sub === Sub.Bytes) {
        i = this.scanBytes(buf, i);
        continue;
      }
      if (this.sub === Sub.Skip) {
        i = this.scanSkip(buf, i);
        continue;
      }
      const c = buf[i]!;
      if (isWs(c)) {
        i++;
        continue;
      }
      if (this.state === S.Done) throw new ScanError('Trailing data after map');

      switch (this.sub) {
        case Sub.None: {
          // Expecting a key string, or the close of the current object/array, or an item.
          if (this.state === S.RootOpen) {
            if (c !== C_LBRACE) throw new ScanError('Not a map file');
            this.state = S.RootKey;
            i++;
            break;
          }
          if (this.state === S.KeysItem || this.state === S.ValuesItem) {
            if (c === C_RBRACK) {
              this.state = S.MapPartsKey;
              this.sub = Sub.After;
              i++;
              break;
            }
            if (c === C_LBRACE) {
              if (this.state === S.KeysItem) {
                this.state = S.KeyItemKey;
                this.keyX = this.keyY = 0;
              } else {
                this.state = S.ValueItemKey;
                this.png = null;
                this.ts = null;
                this.partHash = 0x811c9dc5;
              }
              i++;
              break;
            }
            if (this.state === S.ValuesItem && c === 110 /* n */) {
              if (i + 4 > n && !final) return i;
              this.cb.part(this.valueIndex++, null, 0, null);
              this.sub = Sub.After;
              i += 4;
              break;
            }
            throw new ScanError('Unexpected item in map part list');
          }
          // Inside an object: key or close.
          if (c === C_RBRACE) {
            i++;
            this.closeObject();
            break;
          }
          if (c !== C_QUOTE) throw new ScanError('Expected object key');
          const end = findStringEnd(buf, i + 1);
          if (end < 0) {
            if (final) throw new ScanError('Unterminated string');
            return i;
          }
          this.pendingKey = decodeAscii(buf, i + 1, end);
          this.sub = Sub.Colon;
          i = end + 1;
          break;
        }
        case Sub.Colon:
          if (c !== C_COLON) throw new ScanError('Expected colon');
          this.sub = Sub.Value;
          i++;
          break;
        case Sub.Value: {
          const r = this.value(buf, i, final);
          if (r < 0) return i;
          i = r;
          break;
        }
        case Sub.After:
          if (c === C_COMMA) {
            this.sub = Sub.None;
            i++;
          } else if (c === C_RBRACE) {
            i++;
            this.closeObject();
          } else if (c === C_RBRACK) {
            i++;
            if (this.state === S.KeysItem || this.state === S.ValuesItem) this.state = S.MapPartsKey;
            else throw new ScanError('Unexpected ]');
          } else throw new ScanError('Expected , or closing bracket');
          break;
      }
    }
    return n;
  }

  /** Handle a value for `pendingKey` in the current state. Returns the new position or -1 to carry. */
  private value(buf: Uint8Array, i: number, final: boolean): number {
    const c = buf[i]!;
    const key = this.pendingKey;
    switch (this.state) {
      case S.RootKey:
        if (key === 'mapParts') {
          if (c !== C_LBRACE) throw new ScanError('mapParts is not an object');
          this.state = S.MapPartsKey;
          this.sub = Sub.None;
          return i + 1;
        }
        break;
      case S.MapPartsKey:
        if (key === 'keys' || key === 'values') {
          if (c !== C_LBRACK) throw new ScanError(`${key} is not an array`);
          this.state = key === 'keys' ? S.KeysItem : S.ValuesItem;
          this.sub = Sub.None;
          return i + 1;
        }
        break;
      case S.KeyItemKey:
        if (key === 'x' || key === 'y') {
          let j = i;
          while (j < buf.length && isNumChar(buf[j]!)) j++;
          if (j === buf.length && !final) return -1;
          const v = Number(decodeAscii(buf, i, j));
          if (!Number.isFinite(v)) throw new ScanError('Bad part coordinate');
          if (key === 'x') this.keyX = v;
          else this.keyY = v;
          this.sub = Sub.After;
          return j;
        }
        break;
      case S.ValueItemKey:
        if (key === 'png' || key === 'timestampPng') {
          if (c === 110 /* null */) break;
          if (c !== C_LBRACK) throw new ScanError(`${key} is not a byte array`);
          this.bytesTarget = key === 'png' ? 'png' : 'ts';
          this.bytes = new Uint8Array(key === 'png' ? 40000 : 8000);
          this.bytesLen = 0;
          this.acc = 0;
          this.hasDigit = false;
          this.sub = Sub.Bytes;
          return i + 1;
        }
        break;
    }
    // Not interesting: skip the value.
    this.skipDepth = 0;
    this.skipInString = false;
    this.skipEscape = false;
    this.skipScalar = c !== C_LBRACE && c !== C_LBRACK && c !== C_QUOTE;
    this.sub = Sub.Skip;
    return i;
  }

  private scanBytes(buf: Uint8Array, i: number): number {
    const n = buf.length;
    let acc = this.acc;
    let has = this.hasDigit;
    let png = this.bytes;
    let len = this.bytesLen;
    let h = this.partHash;
    while (i < n) {
      const c = buf[i++]!;
      if (c >= C_ZERO && c <= C_NINE) {
        acc = acc * 10 + (c - C_ZERO);
        has = true;
      } else if (c === C_COMMA || c === C_RBRACK) {
        if (has) {
          if (len === png.length) {
            const grown = new Uint8Array(png.length * 2);
            grown.set(png);
            png = grown;
          }
          png[len++] = acc;
          h = Math.imul(h ^ acc, 0x01000193);
          acc = 0;
          has = false;
        }
        if (c === C_RBRACK) {
          const out = len > 0 ? png.subarray(0, len) : null;
          if (this.bytesTarget === 'png') this.png = out;
          else this.ts = out;
          this.partHash = h;
          this.sub = Sub.After;
          return i;
        }
      } else if (!isWs(c)) {
        throw new ScanError('Unexpected character in PNG byte array');
      }
    }
    this.acc = acc;
    this.hasDigit = has;
    this.bytes = png;
    this.bytesLen = len;
    this.partHash = h;
    return i;
  }

  private scanSkip(buf: Uint8Array, i: number): number {
    const n = buf.length;
    if (this.skipScalar) {
      // number, true, false, null: runs until a delimiter.
      while (i < n) {
        const c = buf[i]!;
        if (c === C_COMMA || c === C_RBRACE || c === C_RBRACK || isWs(c)) {
          this.sub = Sub.After;
          return i;
        }
        i++;
      }
      return i;
    }
    let depth = this.skipDepth;
    let inStr = this.skipInString;
    let esc = this.skipEscape;
    while (i < n) {
      const c = buf[i++]!;
      if (inStr) {
        if (esc) esc = false;
        else if (c === C_BACKSLASH) esc = true;
        else if (c === C_QUOTE) {
          inStr = false;
          if (depth === 0) {
            this.sub = Sub.After;
            return i;
          }
        }
      } else if (c === C_QUOTE) inStr = true;
      else if (c === C_LBRACE || c === C_LBRACK) depth++;
      else if (c === C_RBRACE || c === C_RBRACK) {
        depth--;
        if (depth === 0) {
          this.sub = Sub.After;
          return i;
        }
      }
    }
    this.skipDepth = depth;
    this.skipInString = inStr;
    this.skipEscape = esc;
    return i;
  }

  private closeObject(): void {
    switch (this.state) {
      case S.KeyItemKey:
        this.cb.key(this.keyIndex++, this.keyX, this.keyY);
        this.state = S.KeysItem;
        this.sub = Sub.After;
        return;
      case S.ValueItemKey: {
        const png = this.png;
        this.cb.part(this.valueIndex++, png, png ? this.partHash >>> 0 : 0, this.ts);
        this.png = null;
        this.ts = null;
        this.state = S.ValuesItem;
        this.sub = Sub.After;
        return;
      }
      case S.MapPartsKey:
        this.state = S.RootKey;
        this.sub = Sub.After;
        return;
      case S.RootKey:
        this.state = S.Done;
        this.sub = Sub.None;
        return;
      default:
        throw new ScanError('Unexpected }');
    }
  }
}

function isNumChar(c: number): boolean {
  return (c >= C_ZERO && c <= C_NINE) || c === C_MINUS || c === 43 || c === 46 || c === 101 || c === 69;
}

function findStringEnd(buf: Uint8Array, from: number): number {
  for (let j = from; j < buf.length; j++) {
    const c = buf[j]!;
    if (c === C_BACKSLASH) j++;
    else if (c === C_QUOTE) return j;
  }
  return -1;
}

function decodeAscii(buf: Uint8Array, from: number, to: number): string {
  let s = '';
  for (let j = from; j < to; j++) s += String.fromCharCode(buf[j]!);
  return s;
}
