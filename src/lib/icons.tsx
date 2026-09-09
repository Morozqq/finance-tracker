import type { Icon } from '@phosphor-icons/react'
import {
  AirplaneTilt,
  Baby,
  Barbell,
  Books,
  Briefcase,
  Bus,
  Car,
  CreditCard,
  DotsThreeOutline,
  FilmSlate,
  FirstAid,
  ForkKnife,
  Gift,
  GraduationCap,
  Handshake,
  Heartbeat,
  House,
  Laptop,
  Money,
  MountainsIcon,
  PawPrint,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Sparkle,
  Target,
  TShirt,
  Wallet,
  WifiHigh,
  Wrench,
} from '@phosphor-icons/react'

/** Icon keys are stored in the database, so they must stay stable. */
export const ICONS: Record<string, Icon> = {
  cart: ShoppingCart,
  fork: ForkKnife,
  bus: Bus,
  car: Car,
  house: House,
  wifi: WifiHigh,
  heart: Heartbeat,
  aid: FirstAid,
  shirt: TShirt,
  film: FilmSlate,
  cap: GraduationCap,
  books: Books,
  paw: PawPrint,
  barbell: Barbell,
  plane: AirplaneTilt,
  baby: Baby,
  laptop: Laptop,
  wrench: Wrench,
  gift: Gift,
  dots: DotsThreeOutline,
  wallet: Wallet,
  briefcase: Briefcase,
  money: Money,
  card: CreditCard,
  piggy: PiggyBank,
  receipt: Receipt,
  spark: Sparkle,
  target: Target,
  hands: Handshake,
  mountain: MountainsIcon,
}

export const ICON_KEYS = Object.keys(ICONS)

export function iconOf(key: string): Icon {
  return ICONS[key] ?? DotsThreeOutline
}

/** Mid-saturation hues that hold up on both the light and the dark ground. */
export const SWATCHES = [
  '#E4572E',
  '#F2A93B',
  '#8BB33D',
  '#2FAF8C',
  '#3D93D6',
  '#6C74DB',
  '#A863C9',
  '#DE5D8F',
  '#B98A5A',
  '#7C8794',
]
