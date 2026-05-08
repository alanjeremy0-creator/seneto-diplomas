import { GenerationCard, type GenerationListItem } from './GenerationCard'

export function GenerationList({ generations }: { generations: GenerationListItem[] }) {
  return (
    <ul className="space-y-3" aria-label="Lista de generaciones">
      {generations.map((gen) => (
        <li key={gen.id}>
          <GenerationCard generation={gen} />
        </li>
      ))}
    </ul>
  )
}
