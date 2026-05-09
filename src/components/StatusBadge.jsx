import { ETAPA_MAP } from '../lib/constants'
import { Badge } from './ui'

export default function StatusBadge({ etapa, label, cor, ...rest }) {
  if (label) {
    return <Badge color={cor} {...rest}>{label}</Badge>
  }
  const info = ETAPA_MAP[etapa]
  if (!info) return <Badge {...rest}>{etapa}</Badge>
  return <Badge color={info.cor} {...rest}>{info.label}</Badge>
}
