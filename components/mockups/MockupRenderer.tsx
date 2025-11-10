'use client'

import { IphoneMockupRenderer } from './IphoneMockupRenderer'
import { MacbookMockupRenderer } from './MacbookMockupRenderer'
import { getMockupDefinition } from '@/lib/constants/mockups'
import type { Mockup } from '@/types/mockup'

interface MockupRendererProps {
  mockup: Mockup
  canvasWidth: number
  canvasHeight: number
}

export function MockupRenderer({ mockup, canvasWidth, canvasHeight }: MockupRendererProps) {
  const definition = getMockupDefinition(mockup.definitionId)
  if (!definition) return null
  if (definition.type === 'iphone') {
    return <IphoneMockupRenderer mockup={mockup} canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
  }
  return <MacbookMockupRenderer mockup={mockup} canvasWidth={canvasWidth} canvasHeight={canvasHeight} />
}

