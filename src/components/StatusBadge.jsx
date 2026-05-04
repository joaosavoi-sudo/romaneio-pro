import { ETAPA_MAP } from '../lib/constants'
import { Badge } from './ui'

export default function StatusBadge({ etapa }) {
  const info = ETAPA_MAP[etapa]
  if (!info) return <Badge>{etapa}</Badge>
  return <Badge color={info.cor}>{info.label}</Badge>
}
