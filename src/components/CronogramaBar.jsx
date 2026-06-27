import { calcFases, posicaoHoje, fmtData, temCronograma } from '../lib/cronograma'

// Barra única = 100% do prazo, dividida nas 4 fases macro.
// Renderizada com estilos inline para funcionar igual no app e no relatório PDF.
// Props:
//   - obra: registro da obra (data_inicio, prazo_dias, cronograma_fases)
//   - compact: esconde a legenda de fases (só a barra + marcador hoje)
//   - realizado: { fase: {inicio, fim} } com datas reais (de calcRealizado) — opcional.
//                Desenha um segundo track "realizado" sob a barra de previsto.
export default function CronogramaBar({ obra, compact = false, realizado = null }) {
  const fases = calcFases(obra)
  const hoje = posicaoHoje(obra)
  const definido = temCronograma(obra)

  const prazoNum = Number(obra?.prazo_dias) || 0
  // Converte uma data real em % da barra (mesma escala do previsto: data_inicio + prazo).
  function pctData(d) {
    if (!obra?.data_inicio || !(prazoNum > 0) || !d) return 0
    const ini = new Date(obra.data_inicio); ini.setHours(0, 0, 0, 0)
    const x = new Date(d); x.setHours(0, 0, 0, 0)
    const dias = Math.round((x.getTime() - ini.getTime()) / 86400000)
    return Math.max(0, Math.min(100, (dias / prazoNum) * 100))
  }
  const temRealizado = realizado && definido && Object.keys(realizado).length > 0

  return (
    <div>
      {/* Barra */}
      <div style={{ position: 'relative', marginBottom: temRealizado ? 4 : (compact ? 0 : 12) }}>
        <div
          style={{
            display: 'flex',
            height: 30,
            borderRadius: 8,
            overflow: 'hidden',
            backgroundColor: '#f3f4f6',
          }}
        >
          {fases.map(f => (
            <div
              key={f.chave}
              title={`${f.label} — ${f.pct}%`}
              style={{
                width: `${f.pct}%`,
                backgroundColor: f.cor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {f.pct >= 8 ? `${f.pct}%` : ''}
            </div>
          ))}
        </div>

        {/* Marcador "hoje" */}
        {definido && hoje && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              bottom: -4,
              left: `${hoje.pct}%`,
              width: 2,
              backgroundColor: '#111827',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -16,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 9,
                fontWeight: 700,
                color: '#111827',
                whiteSpace: 'nowrap',
              }}
            >
              hoje
            </span>
          </div>
        )}
      </div>

      {/* Track "realizado" (datas reais derivadas do scanner) */}
      {temRealizado && (
        <div style={{ marginBottom: compact ? 0 : 12 }}>
          {!compact && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9ca3af', marginBottom: 2 }}>
              <span>Realizado (scanner)</span>
              <span>faixa cheia = concluído · tracejado = em andamento</span>
            </div>
          )}
          <div style={{ position: 'relative', height: 10, borderRadius: 4, backgroundColor: '#f3f4f6', overflow: 'hidden' }}>
            {Object.entries(realizado).map(([chave, r]) => {
              const fase = fases.find(f => f.chave === chave)
              if (!fase || !r.inicio) return null
              const x1 = pctData(r.inicio)
              const x2 = r.fim ? pctData(r.fim) : (hoje ? hoje.pct : x1)
              const left = Math.min(x1, x2)
              const width = Math.max(1.5, Math.abs(x2 - x1))
              const emAndamento = !r.fim
              return (
                <div
                  key={chave}
                  title={`${fase.label} — realizado: ${fmtData(r.inicio)} → ${r.fim ? fmtData(r.fim) : 'em andamento'}`}
                  style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `${left}%`, width: `${width}%`,
                    backgroundColor: fase.cor,
                    opacity: emAndamento ? 0.45 : 0.85,
                    borderRight: emAndamento ? `2px dashed ${fase.cor}` : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Legenda por fase */}
      {!compact && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 8,
          }}
        >
          {fases.map(f => {
            const corrente = hoje?.faseChave === f.chave
            return (
              <div
                key={f.chave}
                style={{
                  border: corrente ? `2px solid ${f.cor}` : '1px solid #e5e7eb',
                  backgroundColor: corrente ? f.cor + '10' : '#fff',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: f.cor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{f.label}</span>
                  {corrente && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: f.cor, marginLeft: 'auto' }}>ATUAL</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', paddingLeft: 16 }}>
                  <strong style={{ color: '#374151' }}>{f.pct}%</strong>
                  {definido && (
                    <span> · {fmtData(f.dataInicio)} → {fmtData(f.dataFim)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
