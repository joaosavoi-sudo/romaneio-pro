import { useId } from 'react'
import useEquipe from '../hooks/useEquipe'

// Input de responsável com autocomplete a partir da equipe cadastrada (datalist).
// Permite escolher um nome da lista OU digitar livremente (compatível com dados
// antigos). Repassa props extras (ex.: onBlur) para o <input>.
export default function ResponsavelInput({
  label = 'Responsável',
  value,
  onChange,
  placeholder = 'Selecione ou digite',
  className = '',
  ...rest
}) {
  const { nomes } = useEquipe()
  const listId = useId()
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <input
        list={listId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        {...rest}
      />
      <datalist id={listId}>
        {nomes.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  )
}
