# MotorRoute — Routing Service

Microsserviço de roteamento do **MotoTracker**. Calcula trajetos A → B para motociclistas via **OSRM** (Open Source Routing Machine) com um perfil `motorcycle` próprio, **sem depender de APIs de mapa de terceiros** (Google Maps, Mapbox, etc.).

O motor de roteamento roda localmente (Docker), o que garante privacidade dos dados, custo zero por requisição e baixa latência — o mapa coberto é o estado do **Rio Grande do Sul**.

## Destaques técnicos

- **OSRM self-hosted** com perfil `motorcycle` customizado (derivado do `car.lua` oficial), que prioriza vias compatíveis com moto e ignora restrições de carro (altura/largura).
- **Auth via Firebase** — validação de JWT RS256 com JWKS remoto (`jose`), sem SDK do Firebase no servidor.
- **Rate limit por usuário** (`uid` do JWT), com fallback para IP quando autenticação está desativada.
- **API tipada e validada** — schemas JSON + validação com `zod`, config de ambiente tipada e verificada no boot.
- **TypeScript estrito**, testes unitários + integração (Vitest), build Docker multi-stage e graceful shutdown.

## Stack

| Camada | Tecnologia |
| --- | --- |
| API | Fastify 5 + TypeScript (Node.js 20+) |
| Auth | Firebase Auth — JWT RS256 via JWKS (`jose`) |
| Rate limit | `@fastify/rate-limit` (por `uid`, fallback IP) |
| Motor de rota | `osrm/osrm-backend` + perfil `osrm/profiles/motorcycle.lua` |
| Mapa | Rio Grande do Sul (OSM.fr, ~158 MB) |
| Testes | Vitest (unitário + integração) |
| Infra | Docker Compose + multi-stage Dockerfile |

## Arquitetura

```text
┌──────────────────────────────────────────────┐
│ Cliente (app / web / curl)                   │
│  Authorization: Bearer <FIREBASE_ID_TOKEN>   │
└──────────────────────┬───────────────────────┘
                       │ GET /api/v1/route
┌──────────────────────▼───────────────────────┐
│ API — Fastify (porta 3000)                   │
│  ├ helmet · CORS origin=false · sensible     │
│  ├ rate-limit (por uid / IP)                 │
│  ├ Firebase Auth — JWT RS256 (JWKS)          │
│  └ zod (validação de entrada/config)         │
└──────────────────────┬───────────────────────┘
                       │ HTTP interno (rede docker)
┌──────────────────────▼───────────────────────┐
│ OSRM backend (porta 5000, só 127.0.0.1)      │
│  GET /route/v1/motorcycle/{lng1},{lat1};…    │
│  perfil: osrm/profiles/motorcycle.lua        │
└──────────────────────────────────────────────┘
```

## Pré-requisitos (Linux)

| Ferramenta | Versão |
| --- | --- |
| Node.js | **20+** (inclui `npm`) |
| Docker Engine | 24+ |
| Docker Compose | v2 (plugin `docker compose` ou `docker-compose`) |

Verifique com:

```bash
node --version      # v20+
npm --version
docker --version
docker compose version
```

> A primeira preparação do grafo do RS baixa ~158 MB e exige **~4 GB de RAM** por alguns minutos. Nas execuções seguintes o volume Docker `osrm-data` é reutilizado.

## Instalação

```bash
# 1. Clonar
git clone <URL_DO_REPOSITORIO> motor-route
cd motor-route

# 2. Instalar dependências da API
npm install

# 3. Configurar o ambiente
cp .env.example .env
```

Edite o `.env` e preencha ao menos:

```env
AUTH_ISSUER_URL=https://securetoken.google.com/<SEU_PROJECT_ID>
FIREBASE_PROJECT_ID=<SEU_PROJECT_ID>
```

## Como rodar

### Opção A — Stack completa com Docker (mais simples)

Sobe **API + OSRM** juntos. A API compila e roda dentro do container:

```bash
docker compose up --build
```

- API: `http://localhost:3000`
- Health check: `curl http://localhost:3000/health`
- OSRM: `http://127.0.0.1:5000` (publicado **apenas** em localhost, rede interna)

### Opção B — API local + OSRM no Docker (desenvolvimento)

```bash
# 1. Sobe o OSRM (download + extract/partition/customize na 1ª vez)
docker compose up osrm

# 2. API em modo dev (tsx watch, aponta para http://localhost:5000)
npm run dev
```

### Sem Firebase (desenvolvimento/testes)

No `.env`:

```env
AUTH_DISABLED=true
```

Com isso, todas as rotas ficam abertas e o rate limit passa a usar o IP como chave.

## Variáveis de ambiente

Ver `.env.example`. Todas validadas por `zod` no boot — o servidor não sobe com config inválida.

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP da API |
| `HOST` | `0.0.0.0` | Host de escuta |
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `LOG_LEVEL` | `info` | Nível de log do Pino |
| `OSRM_URL` | `http://localhost:5000` | URL base do OSRM |
| `OSRM_TIMEOUT_MS` | `15000` | Timeout das chamadas internas ao OSRM |
| `PARAM_OVERVIEW` | `full` | `full` \| `simplified` \| `false` |
| `PARAM_GEOMETRIES` | `geojson` | `geojson` \| `polyline` \| `polyline6` |
| `DEFAULT_PROFILE` | `motorcycle` | Perfil usado na URL do OSRM |
| `AUTH_ISSUER_URL` | — | **obrigatória** — issuer do JWT Firebase |
| `FIREBASE_PROJECT_ID` | derivado do issuer | Usado como `audience` do JWT |
| `AUTH_DISABLED` | `false` | Desativa validação JWT (só dev/testes) |
| `RATE_LIMIT_MAX` | `60` | Máximo de requisições por janela |
| `RATE_LIMIT_WINDOW` | `1 minute` | Janela do rate limit |

A URL interna montada para o OSRM:

```text
{OSRM_URL}/route/v1/{DEFAULT_PROFILE}/{lng1},{lat1};{lng2},{lat2}?overview={PARAM_OVERVIEW}&geometries={PARAM_GEOMETRIES}&steps=false&alternatives=false
```

> **Atenção:** o OSRM espera `lon,lat`. A API pública recebe `lat,lng` e converte internamente (`src/utils/coordinates.ts`).

## API

### `GET /health` — público

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "service": "motor-route", "profile": "motorcycle" }
```

### `GET /api/v1/route?origin={lat,lng}&destination={lat,lng}` — autenticado

```bash
curl "http://localhost:3000/api/v1/route?origin=-29.7608,-50.0200&destination=-30.0346,-51.2177" \
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>"
```

```json
{
  "distance": 125500,
  "duration": 5400,
  "geometry": {
    "type": "LineString",
    "coordinates": [[-50.02, -29.76], [-51.23, -30.03]]
  }
}
```

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `origin` / `destination` | string | Coordenadas `lat,lng` |
| `distance` | number | Distância em metros |
| `duration` | number | Tempo em segundos |
| `geometry` | GeoJSON | `LineString` com `[lng, lat]` por ponto |

### Erros

Toda resposta de erro segue o formato `{ error, code, message }`:

| HTTP | `code` | Cenário |
| --- | --- | --- |
| 400 | `INVALID_QUERY` | `origin` ou `destination` ausentes |
| 400 | `INVALID_COORDINATES` | Coordenadas malformadas ou fora do range (`lat` ±90, `lng` ±180) |
| 401 | `MISSING_TOKEN` | Cabeçalho `Authorization` ausente |
| 401 | `INVALID_TOKEN` | JWT inválido/malformado |
| 401 | `TOKEN_EXPIRED` | JWT expirado |
| 404 | `ROUTE_NOT_FOUND` | OSRM não encontrou rota entre os pontos |
| 429 | `RATE_LIMITED` | Limite de requisições excedido |
| 502 | `OSRM_UNAVAILABLE` | OSRM inacessível ou resposta inválida |
| 500 | `INTERNAL_ERROR` | Erro inesperado |

## Testes

```bash
npm test              # roda toda a suíte (vitest)
npm run test:watch    # modo watch
npm run typecheck     # tsc --noEmit
```

A suíte cobre: parsing e validação de coordenadas, montagem da URL OSRM, contrato da resposta, erros (`INVALID_COORDINATES`, `ROUTE_NOT_FOUND`, `OSRM_UNAVAILABLE`), ausência/token inválido e a rota `/health`.

## Build e produção

```bash
npm run build   # compila para dist/ (tsc)
npm start       # node dist/server.js (requer NODE_ENV=production + variáveis de ambiente)
```

O `Dockerfile` é multi-stage (`deps` → `build` → `runner`) e roda com `NODE_ENV=production` como usuário `node`, sem devDependencies.

## Estrutura

```text
motor-route/
├── src/
│   ├── app.ts                    # composição do Fastify (plugins, hooks, rotas)
│   ├── server.ts                 # bootstrap + graceful shutdown
│   ├── config/env.ts             # schemas zod + loading do ambiente
│   ├── controllers/routeController.ts
│   ├── middlewares/auth.ts       # verificação JWT RS256 (JWKS)
│   ├── routes/route.ts           # GET /api/v1/route (schema JSON)
│   ├── services/osrmService.ts   # cliente HTTP do OSRM + mapping da resposta
│   └── utils/                    # coordinates, errors, etc.
├── osrm/profiles/motorcycle.lua  # perfil customizado do OSRM
├── scripts/prepare-osrm.sh       # alternativa manual ao compose
├── tests/                        # unit + integração (Vitest)
├── examples/web/                 # frontend de demonstração (React + Vite + Leaflet)
├── docker-compose.yml            # osrm-download / osrm-prepare / osrm / api
├── Dockerfile                    # multi-stage build
└── .env.example                  # template de configuração
```

## Perfil `motorcycle`

O OSRM oficial não inclui um perfil de moto. `osrm/profiles/motorcycle.lua` deriva do `car.lua` oficial (api_version 4) e ajusta:

- **Hierarquia de acesso**: `motorcycle` → `motor_vehicle` → `vehicle` (preferência sobre `motorcar`).
- **Envelope menor** (`vehicle_height`/`width` reduzidos): passa por barreiras de altura/largura que bloqueiam carros.
- **Penalidades menores** de curva/U-turn e `continue_straight_at_waypoint = true`: roteamento mais ágil.
- **`highway=track` roteável**: estradas de interior comuns no RS.
- `weight_name = 'routability'`: prioriza vias boas para moto, não apenas a menor distância.

## Frontend de demonstração

Em `examples/web` há um app **React + Vite + Leaflet** que consome a API e desenha a geometria no mapa:

```bash
# API na porta 8888 com auth desativada
AUTH_DISABLED=true PORT=8888 npm run dev

# Frontend (outro terminal)
cd examples/web
npm install
npm run dev
```

Abra `http://localhost:5173`. O Vite faz proxy de `/api` para `http://127.0.0.1:8888` (evita CORS). Para mudar o alvo: `API_PROXY_TARGET=http://127.0.0.1:3000 npm run dev`.

## Segurança

- `helmet` com headers de segurança; CORS com `origin: false` (sem origem externa).
- OSRM **não** é exposto publicamente (porta `5000` apenas em `127.0.0.1`).
- `.env` e arquivos de credencial/certificado são ignorados no `.gitignore` e `.dockerignore`.
- Config validada no boot e timeouts em todas as chamadas externas.