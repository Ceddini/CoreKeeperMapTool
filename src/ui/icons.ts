import {
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  Eye,
  FolderOpen,
  Grid3x3,
  Heart,
  Image,
  Info,
  Keyboard,
  Layers,
  LoaderCircle,
  LocateFixed,
  Map,
  MapPin,
  Maximize,
  Minus,
  PanelLeftClose,
  Pickaxe,
  Pipette,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings,
  TriangleAlert,
  Undo2,
  Upload,
  X,
  createElement,
  type IconNode,
} from 'lucide';

const ICONS = {
  check: Check,
  chevron: ChevronDown,
  help: CircleHelp,
  command: Command,
  copy: Copy,
  crosshair: Crosshair,
  download: Download,
  external: ExternalLink,
  eye: Eye,
  folder: FolderOpen,
  grid: Grid3x3,
  heart: Heart,
  image: Image,
  info: Info,
  keyboard: Keyboard,
  layers: Layers,
  loader: LoaderCircle,
  locate: LocateFixed,
  map: Map,
  pin: MapPin,
  fit: Maximize,
  minus: Minus,
  panelClose: PanelLeftClose,
  tiles: Pickaxe,
  pipette: Pipette,
  plus: Plus,
  live: Radio,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  warning: TriangleAlert,
  undo: Undo2,
  upload: Upload,
  close: X,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

/** Decorative icon (hidden from assistive tech; the control carries the label). */
export function icon(name: IconName, size = 18): SVGElement {
  const el = createElement(ICONS[name]);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  el.classList.add('icon');
  return el;
}
