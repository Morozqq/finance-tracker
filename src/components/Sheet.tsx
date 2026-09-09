import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Sheets that own the whole screen (the amount pad) skip the grabber. */
  full?: boolean
}

/**
 * Bottom sheet with drag-to-dismiss. Motion drives the gesture so the drag
 * never round-trips through React state.
 */
export function Sheet({ open, onClose, title, children, full = false }: SheetProps) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-[520px] rounded-t-[var(--r-sheet)] bg-surface"
            style={{
              boxShadow: 'var(--shadow-sheet)',
              maxHeight: full ? '94dvh' : '88dvh',
            }}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose()
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-1 w-9 rounded-full bg-line-strong" />
            </div>
            {title && (
              <h2 className="px-5 pt-1 pb-3 text-[17px] font-semibold tracking-[-0.01em]">
                {title}
              </h2>
            )}
            <div
              className="overflow-y-auto overscroll-contain px-5"
              style={{
                maxHeight: full ? 'calc(94dvh - 60px)' : 'calc(88dvh - 60px)',
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
