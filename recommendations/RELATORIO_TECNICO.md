# Relatório Técnico — Sistema de Recomendação NCF para Motociclistas (MotoTracker)

**Projeto:** `motor-route/recommendations`
**Disciplina:** Pós-graduação em Engenharia de IA Aplicada
**Status:** Estudo concluído

---

## 1. Objetivo

Construir um sistema de recomendação de destinos para motociclistas usando **Neural Collaborative Filtering (NCF)** — modelo *NeuMF* com *side-information* — sobre um dataset sintético com regras de negócio conhecidas (ground truth injetado). O estudo valida: (a) se o modelo aprende as regras, (b) qual arquitetura generaliza melhor e (c) como o protocolo de avaliação impacta as métricas.

## 2. Dataset Sintético

| Arquivo | Registros | Colunas-chave |
| --- | --- | --- |
| `users.csv` | 5.000 | user_id, tipo_moto, idade |
| `items.csv` | 3.000 | item_id, catalog_version, h3_center, indice_sinuosidade, pct_asfalto, variancia_elevacao, categoria_destino, pct_terra |
| `interactions.csv` | 50.000 | trip_id, user_id, item_id, distancia_total_km, target, sample_weight |

Perfis de moto: Speed, BigTrail, Custom, BaixaCilindrada (~25% cada).

### Regras de Ground Truth injetadas (calibragem v2)

Probabilidade base de afinidade = **0.15** (reduz ruído); regra de perfil adiciona **+0.65** ao score.

| Perfil | Regra | Cobertura no catálogo |
| --- | --- | --- |
| BigTrail | `pct_terra > 0.40` AND `variancia_elevacao > 700` | 28% |
| Speed | `pct_asfalto > 0.75` AND `indice_sinuosidade > 1.15` | 24% |
| Custom | categoria `Gastronomico/Historico` AND `indice_sinuosidade < 1.50` | 21% |
| BaixaCilindrada | `distancia_total_km <= 80` (senão penalidade -0.5) | — (regra por distância) |

A v1 usava base 0.5 com regras fracas (Speed 12% de cobertura) e **P(match | target=1) ≈ 0.2**, ou seja, o modelo aprendia ruído aleatório. A v2 equilibra cobertura (~25-30%) e fortalece o sinal.

## 3. Arquiteturas Comparadas

| Modelo | Ramo colaborativo | Ramo de conteúdo | Parâmetros |
| --- | --- | --- |---|
| **NeuMF** | GMF (user×item) + MLP embeddings | tipo_moto, categoria, idade, features numéricas, distância | ~1,3M |
| **PureMLP** | — | só side-info (tipo_moto, categoria, idade, features numéricas, distância) | ~35k |

Perda: **BCE com sample_weight** (peso maior para viagens com tempo de parada/repetição). Split: leave-one-out (1 interação positiva por usuário reservada p/ teste).

## 4. Protocolo de Avaliação

- **Leave-one-out:** 1 interação positiva por usuário no teste (4.797 usuários).
- **Negativos:** 100 itens amostrados uniformemente do catálogo; distância sorteada `uniform(lo, hi)` por tipo de moto.
- **Métricas:** HR@10 e NDCG@10. Item positivo usa a distância real da viagem.

## 5. Resultados

> **Nota de reprodutibilidade:** os números abaixo foram recalculados sobre o dataset v2 correto (após alinhar o diretório de saída do gerador com o lido pelo `config.py` — ver §7).

### 5.1 Comparativo final (dataset v2)

| Modelo | AUC treino | AUC teste | HR@10 | NDCG@10 |
|---|---|---|---|---|
| NeuMF | 0.996 | 0.637 | 0.203 | 0.093 |
| **PureMLP** | 0.855 | **0.686** | **0.234** | **0.105** |
| Oráculo (teto) | — | 0.699 | 0.726* | — |

\* O HR@10 do oráculo é inflado por artefato do `np.argsort` estável (empates em score exato colocam o positivo, índice 0, à frente). Ver §5.3. Pela métrica de AUC (robusta a empates), o PureMLP alcança **98% do teto** (0.686 vs 0.699).

### 5.2 Teto teórico do protocolo e HR@10 relativo

O teto teórico por tipo considera a fração de negativos sorteados que **também satisfazem a regra** (empates legítimos — itens que o modelo acerta ao marcar como "bom"):

| Perfil | P(válido) | Teto HR@10 | PureMLP HR@10 | HR relativo |
|---|---|---|---|---|
| BaixaCilindrada | 0.652 | 0.151 | 0.149 | **98,7%** |
| BigTrail | 0.285 | 0.339 | 0.248 | 73,2% |
| Speed | 0.239 | 0.401 | 0.253 | 63,1% |
| Custom | 0.211 | 0.453 | 0.288 | 63,6% |

Teto teórico = `K / (n_válidos + 1)` com `n_válidos = P(válido) × 100`.

A regra de distância (BaixaCilindrada) é aprendida quase ao teto (99%); as regras de conteúdo (BigTrail/Speed/Custom) ficam em 63-73% — o MLP captura o sinal de distância mais facilmente que interações de múltiplas features.

### 5.3 Diagnóstico decisivo (inspeção de predições)

Inspeção de um caso BaixaCilindrada (viagem real = 33 km):

| Item | Distância | Score do modelo |
|---|---|---|
| **Positivo** | 33 km | 0.826 |
| Negativos válidos | 5, 30, 48, 68 km | 0.83–0.88 |
| Negativos inválidos | 95, 113 km | 0.06–0.08 |

O PureMLP **aprendeu a regra de distância perfeitamente** (score 0.88 p/ dist<80 vs 0.06 p/ dist>80). O HR@10 de 0.149 contra teto de 0.151 = **98,7% da capacidade do protocolo** em BaixaCilindrada. O "gap" restante não é do modelo — é impossível distinguir o positivo dos ~65 negativos igualmente válidos.

O oráculo parecia excelente em BaixaCilindrada (0.96) **por um artefato de desempate**: ao atribuir score exatamente igual (0.80) a todos os itens válidos, o `np.argsort` estável mantém o positivo (índice 0) no topo. Sem esse artefato, o oráculo ficaria em ~0.15, igual ao modelo.

## 6. Grandes Aprendizados

1. **PureMLP > NeuMF em dados esparsos com side-info forte.** O ramo colaborativo do NeuMF memoriza os IDs (AUC treino 0.996 → teste 0.637); o MLP de conteúdo generaliza melhor (0.855 → 0.686). Em cenários onde o sinal está nas features (perfil do usuário + atributos do item), embeddings colaborativos puros agregam pouco e overfittam.

2. **O modelo capturou decisões numéricas não lineares.** A diferença drástica de score entre distância <80 km (0.88) e >80 km (0.06) demonstra que o MLP aprendeu os limites de decisão do ground truth — não apenas correlações lineares.

3. **Audite o protocolo antes de condenar a performance.** Em BaixaCilindrada, o HR@10 (0.149) era ~99% do teto teórico (0.151) — os negativos sorteados aleatoriamente continham ~65% de itens legítimos que também satisfaziam a regra. Avaliar métricas de ranking sem medir o teto do protocolo leva a conclusões erradas sobre a capacidade do modelo.

## 7. Como Reproduzir

```bash
cd recommendations
# 1. Regenerar o dataset (opcional — CSVs já versionados em data/)
.venv/bin/python datagen/generate_dataset.py

# 2. Treinar e avaliar o NeuMF
.venv/bin/python -u main.py

# 3. Comparativo NeuMF vs PureMLP
.venv/bin/python -u compare.py
```

> O gerador salva os CSVs em `data/` (mesmo diretório lido pelo `config.py`), garantindo que os artefatos avaliados sejam os mesmos gerados.

Dependências: Python 3.13 (`uv` + `--system-site-packages`), torch 2.13, pandas, numpy. Eval ~1min, treino de 120 epochs ~2min.

## 8. Limitações e Próximos Passos

- **Códigos H3 sintéticos não são células H3 válidas** — irrelevante para o treino (a distância vem do CSV), mas inválido para teste de geofiltros reais.
- A **amostragem de negativos uniforme** cria empates artificiais. Para produção, amostrar negativos com distância/viabilidade realista do perfil.
- Treinar NeuMF com **pretraining das duas metades** (GMF e MLP separados, como no paper original) antes de juntar pode recuperar o ramo colaborativo.
- Cold start e versionamento de catálogo (`catalog_version`) ficaram fora do escopo deste experimento.
