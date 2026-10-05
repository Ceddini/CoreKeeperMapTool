/**
 * Live refresh: polls the picked file handle for changes (the game rewrites the map file while
 * you play) and re-ingests incrementally. Pauses while the tab is hidden.
 */
export class FileWatcher {
  private handle: FileSystemFileHandle | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastModified = 0;
  private lastSize = 0;
  private busy = false;
  private enabled = false;
  private readonly onChange: (file: File) => Promise<boolean>;
  private readonly onState: (s: 'watching' | 'paused' | 'off') => void;
  private readonly intervalMs: number;

  constructor(
    onChange: (file: File) => Promise<boolean>,
    onState: (s: 'watching' | 'paused' | 'off') => void,
    intervalMs = 1500,
  ) {
    this.onChange = onChange;
    this.onState = onState;
    this.intervalMs = intervalMs;
    document.addEventListener('visibilitychange', () => {
      if (!this.enabled) return;
      if (document.hidden) this.stopTimer();
      else this.schedule(0);
      this.emit();
    });
  }

  get hasHandle(): boolean {
    return !!this.handle;
  }

  setHandle(handle: FileSystemFileHandle | null, file?: File): void {
    this.handle = handle;
    this.lastModified = file?.lastModified ?? 0;
    this.lastSize = file?.size ?? 0;
    this.emit();
    if (this.enabled) this.schedule(this.intervalMs);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.schedule(0);
    else this.stopTimer();
    this.emit();
  }

  private emit(): void {
    this.onState(!this.enabled || !this.handle ? 'off' : document.hidden ? 'paused' : 'watching');
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(ms: number): void {
    this.stopTimer();
    if (!this.enabled || !this.handle || document.hidden) return;
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private async tick(): Promise<void> {
    if (!this.handle || this.busy) return this.schedule(this.intervalMs);
    this.busy = true;
    try {
      const file = await this.handle.getFile();
      if (file.lastModified !== this.lastModified || file.size !== this.lastSize) {
        // Only advance the watermark when the file parsed: a half-written file is retried.
        if (await this.onChange(file)) {
          this.lastModified = file.lastModified;
          this.lastSize = file.size;
        }
      }
    } catch {
      // Permission revoked or file moved: pause until the user acts.
      this.enabled = false;
      this.onState('paused');
      this.busy = false;
      return;
    }
    this.busy = false;
    this.schedule(this.intervalMs);
  }
}
