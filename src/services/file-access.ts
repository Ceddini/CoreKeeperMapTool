/**
 * Getting the map file: File System Access API where available (lets us re-open the file next
 * time and watch it for changes), a plain <input type=file> elsewhere, drag & drop, and the PWA
 * launch queue (opening a .gzip from the OS).
 */

const DB = 'ckmt';
const STORE = 'handles';
const LAST = 'last';

export interface PickedFile {
  file: File;
  handle: FileSystemFileHandle | null;
}

interface PermissionHandle extends FileSystemFileHandle {
  queryPermission?(d: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'read' }): Promise<PermissionState>;
}

type PickerWindow = Window & {
  showOpenFilePicker?(opts?: unknown): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(opts?: unknown): Promise<FileSystemFileHandle>;
  launchQueue?: { setConsumer(fn: (p: { files: FileSystemFileHandle[] }) => void): void };
};

const w = window as PickerWindow;

export const supportsHandles = typeof w.showOpenFilePicker === 'function';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await idb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T | undefined);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await idb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* storage unavailable */
  }
}

export async function rememberHandle(handle: FileSystemFileHandle): Promise<void> {
  await idbSet(LAST, handle);
}

export async function lastHandle(): Promise<FileSystemFileHandle | null> {
  if (!supportsHandles) return null;
  return (await idbGet<FileSystemFileHandle>(LAST)) ?? null;
}

/** Re-open the last file; asks for permission (must be called from a user gesture). */
export async function reopenLast(): Promise<PickedFile | null> {
  const handle = (await lastHandle()) as PermissionHandle | null;
  if (!handle) return null;
  const state = (await handle.queryPermission?.({ mode: 'read' })) ?? 'granted';
  if (state !== 'granted' && (await handle.requestPermission?.({ mode: 'read' })) !== 'granted') return null;
  return { file: await handle.getFile(), handle };
}

let input: HTMLInputElement | null = null;

function pickWithInput(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    input?.remove();
    input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gzip,.gz,.json,application/gzip';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const f = input!.files?.[0];
      resolve(f ? { file: f, handle: null } : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickFile(): Promise<PickedFile | null> {
  if (!supportsHandles) return pickWithInput();
  try {
    const [handle] = await w.showOpenFilePicker!({
      id: 'core-keeper-map',
      types: [{ description: 'Core Keeper map', accept: { 'application/gzip': ['.gzip', '.gz'] } }],
      excludeAcceptAllOption: false,
    });
    if (!handle) return null;
    void rememberHandle(handle);
    return { file: await handle.getFile(), handle };
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null;
    // Some embedded browsers expose the API but block it: fall back.
    return pickWithInput();
  }
}

/** Extract a file (and handle, on Chromium) from a drop event. */
export async function fromDrop(e: DragEvent): Promise<PickedFile | null> {
  const item = e.dataTransfer?.items?.[0];
  if (item && 'getAsFileSystemHandle' in item) {
    try {
      const h = await (
        item as DataTransferItem & { getAsFileSystemHandle(): Promise<FileSystemHandle | null> }
      ).getAsFileSystemHandle();
      if (h && h.kind === 'file') {
        const handle = h as FileSystemFileHandle;
        void rememberHandle(handle);
        return { file: await handle.getFile(), handle };
      }
    } catch {
      /* fall through */
    }
  }
  const f = e.dataTransfer?.files?.[0];
  return f ? { file: f, handle: null } : null;
}

export function onLaunch(fn: (p: PickedFile) => void): void {
  w.launchQueue?.setConsumer(async ({ files }) => {
    const handle = files[0];
    if (!handle) return;
    void rememberHandle(handle);
    fn({ file: await handle.getFile(), handle });
  });
}

export async function saveBlob(blob: Blob, suggestedName: string): Promise<boolean> {
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const h = await w.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
      });
      const writable = await (
        h as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }
      ).createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
