import { MAZE_EXTENT_RADII } from '../data/world-layout.ts';

/** Shared between the UI and the worker without pulling worker code into the main bundle. */
export const MAZE_WINDOW_RADIUS = MAZE_EXTENT_RADII.max;
export const MAZE_WINDOW = MAZE_WINDOW_RADIUS * 2 + 1;
export const MAX_EXPORT_PIXELS = 16384 * 16384;
