"use client"
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface SlideOverDrawerProps {
    open: boolean
    onClose: () => void
    children: React.ReactNode
    title?: string
}

export function SlideOverDrawer({ open, onClose, children, title }: SlideOverDrawerProps) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/50"
                    />
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-background p-6 shadow-xl flex flex-col"
                    >
                        <div className="flex items-center justify-between pb-4 border-b">
                            <h2 className="text-lg font-semibold">{title}</h2>
                            <button onClick={onClose} className="rounded-full p-2 hover:bg-muted">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-4">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
