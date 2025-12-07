"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AiFab() {
  const [isVisible, setIsVisible] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  if (!isVisible) return null

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2">
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-2 mb-2 flex items-center gap-2"
          >
            <span className="text-sm font-medium text-gray-700">Hi, it's CarePulse AI</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">Ctrl+J</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 bg-white rounded-full shadow-xl border border-gray-100 flex items-center justify-center group transition-colors hover:border-gray-200"
      >
        <div className="relative">
          <Sparkles className="w-6 h-6 text-gray-800" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#D1F848] rounded-full border-2 border-white" />
        </div>
      </motion.button>
    </div>
  )
}
