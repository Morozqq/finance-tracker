import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { DotsSixVertical } from '@phosphor-icons/react'
import { cx } from './ui'

/** How long a finger rests on a row before it lifts. */
const HOLD_MS = 350
/** Movement allowed during the hold; more than this is a scroll. */
const SLOP_PX = 8

/**
 * A vertical list reordered by dragging. A long press anywhere on a row picks
 * it up, so a quick swipe still scrolls the page and a tap still opens the
 * row. The grip on the right starts a drag at once. The new order is handed to
 * onCommit only when the finger lifts, one write per move.
 */
export function SortableList<T extends { id: string }>({
  items,
  onCommit,
  onOpen,
  children,
}: {
  items: T[]
  onCommit: (ids: string[]) => void
  onOpen: (item: T) => void
  children: (item: T) => ReactNode
}) {
  const key = items.map((i) => i.id).join('|')
  const [order, setOrder] = useState(() => items.map((i) => i.id))
  const orderRef = useRef(order)
  const dragging = useRef(false)

  // Follow the store, except mid-drag, when the local order is the truth.
  useEffect(() => {
    if (dragging.current) return
    const ids = key ? key.split('|') : []
    orderRef.current = ids
    setOrder(ids)
  }, [key])

  const byId = new Map(items.map((i) => [i.id, i]))

  return (
    <Reorder.Group
      as="ul"
      axis="y"
      values={order}
      onReorder={(next) => {
        orderRef.current = next
        setOrder(next)
      }}
      className="flex flex-col gap-1"
    >
      {order.map((id) => {
        const item = byId.get(id)
        if (!item) return null
        return (
          <SortableRow
            key={id}
            value={id}
            onOpen={() => onOpen(item)}
            onLift={() => {
              dragging.current = true
            }}
            onDrop={() => {
              dragging.current = false
              if (orderRef.current.join('|') !== key) onCommit(orderRef.current)
            }}
          >
            {children(item)}
          </SortableRow>
        )
      })}
    </Reorder.Group>
  )
}

function SortableRow({
  value,
  onOpen,
  onLift,
  onDrop,
  children,
}: {
  value: string
  onOpen: () => void
  onLift: () => void
  onDrop: () => void
  children: ReactNode
}) {
  const controls = useDragControls()
  const ref = useRef<HTMLLIElement>(null)
  const held = useRef(false)
  const swallowClick = useRef(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const [lifted, setLifted] = useState(false)

  // Once a row is up, the page must not scroll under the finger. React
  // registers touch listeners as passive, so this one is added by hand.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const block = (e: TouchEvent) => {
      if (held.current) e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])

  const cancelHold = () => {
    window.clearTimeout(timer.current)
    origin.current = null
  }

  const lift = (event: ReactPointerEvent) => {
    cancelHold()
    held.current = true
    swallowClick.current = true
    setLifted(true)
    navigator.vibrate?.(10)
    onLift()
    controls.start(event)
    const drop = () => {
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
      held.current = false
      setLifted(false)
      onDrop()
    }
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
  }

  return (
    <Reorder.Item
      ref={ref}
      value={value}
      dragListener={false}
      dragControls={controls}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        swallowClick.current = false
        origin.current = { x: e.clientX, y: e.clientY }
        timer.current = window.setTimeout(() => lift(e), HOLD_MS)
      }}
      onPointerMove={(e) => {
        if (!origin.current || held.current) return
        if (Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > SLOP_PX) {
          cancelHold()
        }
      }}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      className={cx(
        'relative flex items-center rounded-[var(--r-md)] select-none [-webkit-touch-callout:none]',
        lifted ? 'bg-surface-2 shadow-[var(--shadow-lift)]' : 'bg-surface',
      )}
      whileDrag={{ scale: 1.02 }}
    >
      <button
        type="button"
        onClick={() => {
          // The press that lifted the row is not also a tap.
          if (swallowClick.current) {
            swallowClick.current = false
            return
          }
          onOpen()
        }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--r-md)] py-2 pl-2 text-left transition active:bg-surface-2"
      >
        {children}
      </button>
      <span
        onPointerDown={(e) => {
          e.stopPropagation()
          lift(e)
        }}
        aria-hidden="true"
        className="grid h-11 w-9 shrink-0 cursor-grab touch-none place-items-center text-faint"
      >
        <DotsSixVertical size={18} weight="bold" />
      </span>
    </Reorder.Item>
  )
}
