import type { AppStore, FileInfo, PanelId } from '../core/store.ts';
import type { WorldType } from '../data/schema.ts';
import type { PickedFile } from '../services/file-access.ts';
import type { MapService } from '../services/map-service.ts';
import type { MapView } from '../ui/map-view.ts';
import type { SpotNav } from '../ui/spots.ts';

export interface Actions {
  open(): Promise<void>;
  reopen(): Promise<void>;
  /** Load a bundled example: a fully revealed 1.0+ world, or a played Classic world. */
  example(world?: WorldType): Promise<void>;
  loadPicked(p: PickedFile, source: FileInfo['source']): Promise<void>;
  loadDropped(e: DragEvent): Promise<void>;
  refresh(): Promise<void>;
  setLive(on: boolean): void;
  openExport(): void;
  openShortcuts(): void;
  openPalette(): void;
  setPanel(id: PanelId | null): void;
  togglePanel(id: PanelId): void;
  goTo(x: number, y: number, zoom?: number): void;
  resetSettings(): void;
}

export interface Ctx {
  store: AppStore;
  service: MapService;
  view: MapView;
  actions: Actions;
  supportsLive: boolean;
  spots: SpotNav;
}
