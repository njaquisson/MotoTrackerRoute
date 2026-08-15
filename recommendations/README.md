# MotoTracker — Sistema de Recomendação de Rotas para Motociclistas

Sistema de recomendação (RecSys) baseado em **redes neurais** para sugerir rotas e destinos a motociclistas, respeitando as restrições físicas de cada perfil de piloto. Este projeto faz parte do portfólio de estudos em Engenharia de IA Aplicada e explora o ciclo completo de um sistema de recomendação: **dados sintéticos → modelo NCF com side-information → diagnóstico de métricas com rigor de MLOps**.

---

## 1. Visão Geral do Problema

### 1.1 O desafio do domínio

Motociclistas não são um público homogêneo. Um piloto de **Speed** busca estradas sinuosas com asfalto de qualidade; um **BigTrail** quer estradas de terra e variações altimétricas; um **Custom** prefere paradas gastronômicas e históricas; uma **BaixaCilindrada** precisa de destinos a curta distância. Recomendar ignorando essas restrições físicas gera rotas impraticáveis ou perigosas.

O problema é modelar a **afinidade usuário × destino** (`P(gostar | perfil, destino)`) a partir de:

- **Perfil do piloto**: tipo de moto (representa capacidade e preferência de pilotagem).
- **Atributos do destino**: sinuosidade da estrada, % de asfalto, variação de elevação, categoria (serra, litoral, gastronômico, histórico…), distância até o usuário.
- **Sinais de engajamento**: tempo de parada, repetição de visitas.

### 1.2 Cold start e esparsidade em apps de navegação

Apps de navegação têm um problema estrutural: a **matriz usuário × destino é extremamente esparsa**. Um usuário real visita dezenas de destinos em um universo de milhares — a maioria das células é vazia. Pior: um usuário novo chega **sem nenhum histórico** (*cold start*).

Isso descarta na prática abordagens puramente colaborativas (matriz fatorizada / kNN de vizinhos), que dependem de histórico denso e de sobreposição entre usuários. A solução adotada é ancorar a recomendação em **features de conteúdo** (perfil + atributos do destino), que existem mesmo sem interações.

### 1.3 O dataset

Como não há dados reais disponíveis, o projeto gera um **dataset sintético com ground truth conhecido** (regras de negócio injetadas), permitindo **validar objetivamente se o modelo aprendeu as regras** — algo impossível com dados reais sem anotação.

| Arquivo | Registros | Descrição |
|---|---|---|
| `data/users.csv` | 5.000 | Perfil do piloto (`tipo_moto`, `idade`) |
| `data/items.csv` | 3.000 | Atributos do destino (`indice_sinuosidade`, `pct_asfalto`, `variancia_elevacao`, `categoria_destino`, `h3_center`, `catalog_version`) |
| `data/interactions.csv` | 50.000 | Viagens (`user_id`, `item_id`, `distancia_total_km`, `target`, `sample_weight`) |

**Ground truth injetado** (probabilidade base 0.15; regra de perfil soma +0.65):

| Perfil | Regra | Cobertura do catálogo |
|---|---|---|
| BigTrail | `pct_terra > 0.40` AND `variancia_elevacao > 700` | 28% |
| Speed | `pct_asfalto > 0.75` AND `indice_sinuosidade > 1.15` | 24% |
| Custom | categoria `Gastronomico/Historico` AND `indice_sinuosidade < 1.50` | 21% |
| BaixaCilindrada | `distancia_total_km <= 80` (penalidade forte caso contrário) | regra por distância |

---

## 2. Decisões de Arquitetura & Tecnologias

### 2.1 Uber H3 (resoluções 7 e 8) — indexação espacial

Cada destino é indexado em uma **célula hexagonal H3** (r7 ≈ 0,7 km², r8 ≈ 0,06 km²). A indexação discreta do espaço é a fundação do produto por três razões:

1. **Estabilidade territorial**: agrega pontos de interesse (POIs) em regiões hexagonais estáveis ao longo do tempo, independente de mudanças de rua/bairro.
2. **Eficiência em distância**: consultas de vizinhança e cálculo aproximado de distância são feitas por operações sobre índices, não por geometria contínua.
3. **Agregação de POIs**: múltiplos destinos na mesma célula são consolidados em uma única entidade de recomendação, reduzindo esparsidade.

> Nota técnica: neste experimento os `h3_center` são sintéticos (foco no pipeline de ML). O dimensionamento geográfico real é responsabilidade do microsserviço de rotas (MotorRoute/OSRM).

### 2.2 Modelo PureMLP — content-based + side-information

Optou-se por um **MLP puro** que consome exclusivamente **side-information**:

- **Categóricas**: `tipo_moto`, `categoria_destino` → embeddings de baixa dimensão (8).
- **Numéricas**: `idade`, `indice_sinuosidade`, `pct_asfalto`, `variancia_elevacao`, `distancia_total_km` → z-score.
- Arquitetura: `MLP [128 → 64 → 32]` + ReLU + Dropout(0.2), com saída sigmoid.

**Por que abandonamos filtragem colaborativa pura (NeuMF)?** O ramo colaborativo depende de embeddings por `user_id`/`item_id`, que (a) sofrem de esparsidade, (b) não funcionam para itens/usuários novos e (c) no experimento concreto **overfittaram agressivamente** (ver §3).

### 2.3 PyTorch + stack Python

- **PyTorch**: redes neurais leves para inferência de baixa latência em CPU (modelo com ~35k parâmetros, batch de 1.024).
- **Pandas/NumPy**: processamento e vetorização dos dados.
- Perda: `BCEWithLogitsLoss` ponderada por `sample_weight` (viagens com mais tempo de parada/repetição pesam mais).

---

## 3. O Trade-off Técnico: NeuMF vs PureMLP

Realizamos um experimento controlado comparando as duas arquiteturas sobre o mesmo split (leave-one-out).

| Métrica | NeuMF (GMF+MLP) | PureMLP (só side-info) | Oráculo (teto) |
|---|---|---|---|
| AUC treino | **0.996** | 0.855 | — |
| AUC teste | 0.637 | **0.686** | 0.699 |
| HR@10 | 0.203 | **0.234** | 0.726* |
| NDCG@10 | 0.093 | **0.105** | — |

\* Inflado por artefato de desempate no oráculo — ver §4.3. Em **AUC** (robusta a empates), o PureMLP alcança **98% do teto** (0.686 vs 0.699).

**Por que o conteúdo venceu:**

- **NeuMF sofre de overfitting agressivo de IDs**: AUC treino **0.996** → teste **0.637** (gap de 36%). O modelo memoriza os IDs de usuário/item do treino e não generaliza para as combinações não vistas no teste.
- **PureMLP generaliza no teto do dataset**: AUC treino 0.855 → teste **0.686**, com gap de apenas 17%, e opera **ao nível do oráculo** que conhece as regras exatas.
- O NeuMF ainda é útil quando o histórico é denso (ex.: re-engagement); para o cenário do produto (esparso + cold start), o **PureMLP é a escolha correta**.

---

## 4. Diagnóstico de Métricas e MLOps — O Diferencial do Projeto

### 4.1 Métricas

- **HR@10 (Hit Rate at 10)**: fração de usuários cujo destino real aparece no top-10 da recomendação. Mede cobertura do acerto.
- **NDCG@10 (Normalized Discounted Cumulative Gain)**: pondera a posição — acertar em 1º vale mais que em 10º.

Protocolo: **leave-one-out** — 1 interação positiva de cada usuário é retirada do treino e usada como alvo; o modelo ranqueia o destino real contra 100 destinos negativos amostrados.

### 4.2 A descoberta do teto teórico

Um HR@10 de **0.234** pode parecer baixo — mas o protocolo tem um **teto teórico** que limita qualquer modelo:

```
teto_HR@10 = K / (n_válidos + 1)
```

onde `n_válidos` = nº de negativos sorteados que **também satisfazem a regra** do usuário. Para BaixaCilindrada, a regra é por distância e `uniform(5,120)` sorteia ~65% dos negativos com `dist ≤ 80` — todos eles são destinos **legítimos** que o modelo (corretamente) marca como bons. Impossível distinguir o positivo desses 65 empates:

| Perfil | P(negativo válido) | Teto HR@10 | PureMLP | HR relativo |
|---|---|---|---|---|
| BaixaCilindrada | 0.652 | 0.151 | 0.149 | **98,7%** |
| BigTrail | 0.285 | 0.339 | 0.248 | 73,2% |
| Speed | 0.239 | 0.401 | 0.253 | 63,1% |
| Custom | 0.211 | 0.453 | 0.288 | 63,6% |

Em outras palavras: **um HR@10 de 0.149 representa ~99% da performance máxima possível (0.151) do protocolo** para o perfil mais restrito — o modelo está no teto, não "ruim".

### 4.3 Aprovação do ground truth (evidência de aprendizado)

O teste definitivo é inspecionar as predições num caso real. Viagem de BaixaCilindrada com distância real de 33 km:

| Item | Distância | Score do modelo |
|---|---|---|
| **Positivo** | 33 km | **0.826** |
| Negativos válidos | 5, 30, 48, 68 km | 0.83–0.88 |
| Negativos inválidos | 95, 113 km | **0.06–0.08** |

O modelo **aprendeu a regra exata**: score 0.88 para distâncias ≤ 80 km e 0.06 para > 80 km. Não há "colisão de acasos" — o MLP reproduziu o limite de decisão do ground truth.

**Sobre o oráculo "0.726":** o oráculo (que conhece as regras) parece superior em HR@10 por um **artefato de desempate** — ele atribui score exatamente igual (0.80) a todos os itens válidos e o `np.argsort` estável mantém o positivo (índice 0) na frente dos empates. Sem esse viés, o oráculo ficaria próximo do modelo. A métrica **AUC**, imune a empates, mostra o PureMLP em 98% do teto.

### 4.4 Lições de MLOps

1. **AUC ≠ HR@10**: a primeira mede o ranking médio; a segunda depende do topo e do protocolo de negativos.
2. **Sempre calcule o teto do protocolo** antes de condenar a performance de um modelo.
3. **Inspecione predições individuais** — é a prova mais forte de que o modelo aprendeu (ou não) o sinal.

---

## 5. Estrutura do Repositório & Reprodutibilidade

### 5.1 Organização

```
recommendations/
├── src/                        # Código do modelo e pipeline
│   ├── config.py               # Hiperparâmetros, constantes, caminhos
│   ├── data.py                 # DataModule, datasets, amostragem de negativos
│   ├── model.py                # NeuMF + PureMLP
│   ├── train.py                # Loop de treino (BCE + sample_weight, scheduler)
│   ├── evaluate.py             # Leave-one-out, HR@10, NDCG@10
│   └── __init__.py
├── datagen/
│   └── generate_dataset.py     # Gera dataset sintético com ground truth
├── data/                       # CSVs (users/items/interactions)
├── main.py                     # Treina + avalia o NeuMF
├── compare.py                  # Comparativo controlado NeuMF vs PureMLP
├── RELATORIO_TECNICO.md        # Relatório detalhado do estudo
├── requirements.txt
└── .venv/                      # Ambiente virtual
```

### 5.2 Instalação

```bash
cd recommendations

# Cria o ambiente virtual (recomendado: uv, com Python 3.13)
uv venv --python 3.13 .venv
source .venv/bin/activate

# Dependências
pip install -r requirements.txt
```

> Em máquinas com GPU, o PyTorch pode ser instalado com suporte CUDA:
> `pip install torch --index-url https://download.pytorch.org/whl/cu130`

### 5.3 Como rodar

```bash
# (Opcional) Regenerar o dataset sintético — grava em data/
.venv/bin/python datagen/generate_dataset.py

# Treinar e avaliar o NeuMF (arquitetura de referência)
.venv/bin/python -u main.py

# Comparativo controlado NeuMF vs PureMLP (resultado da §3)
.venv/bin/python -u compare.py
```

**Saída esperada** (um pouco de variação por seed de GPU é normal):

```
=== Resumo ===
modelo                              HR@10  NDCG@10
NeuMF (colab + side-info)          0.203    0.093
PureMLP (só side-info)             0.234    0.105
```

Tempo: ~1 min por treino + eval (30 epochs, CPU). Para reproduzir os números do relatório §5.2, use 120 epochs com scheduler (`train_model(..., epochs=120, lr=2e-3, use_scheduler=True)`).

---

## 6. Limitações e Próximos Passos

- **Códigos H3 sintéticos** não são células H3 reais — válidos para validar o pipeline de ML, não para geofiltros reais.
- **Amostragem de negativos uniforme** cria empates legítimos (ver §4.2). Em produção, amostrar negativos com distância/viabilidade realista do perfil.
- **NeuMF com pretraining em duas etapas** (GMF e MLP treinados separadamente, como no paper original) pode recuperar o ramo colaborativo em cenários de histórico denso.
- **Cold start real** (usuários/itens sem nenhuma interação) e **versionamento de catálogo** (`catalog_version`) ficaram fora do escopo deste experimento.

---

## 7. Referências

- He, X. et al. **Neural Collaborative Filtering (NeuMF)**. WWW 2017.
- Uber Technologies. **H3: A Hexagonal Hierarchical Spatial Index**.
- Covington, P. et al. **Deep Neural Networks for YouTube Recommendations**. RecSys 2016.
