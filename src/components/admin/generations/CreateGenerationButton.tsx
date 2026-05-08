'use client'

import { useState } from 'react'
import { CreateGenerationModal } from './CreateGenerationModal'

export function CreateGenerationButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Nueva generación
      </button>

      <CreateGenerationModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
