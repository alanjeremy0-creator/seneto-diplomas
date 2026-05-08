interface Props {
  value: string | null | undefined
  // DEC-002 hook: when resolved, 'partial' will show first name + last initial only
  displayMode?: 'full' | 'partial'
}

export function StudentName({ value, displayMode = 'full' }: Props) {
  if (!value) return <span className="text-gray-400">—</span>
  // displayMode 'partial' reserved for DEC-002 resolution
  return <span>{value}</span>
}
