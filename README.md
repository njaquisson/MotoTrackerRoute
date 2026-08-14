# MotorRoute — Routing Service

Microsserviço de roteamento do **MotoTracker**. Calcula trajetos A → B para motociclistas via **OSRM** (Open Source Routing Machine) com um perfil `motorcycle` próprio, **sem depender de APIs de mapa de terceiros** (Google Maps, Mapbox, etc.).

O motor de roteamento roda localmente (Docker), o que garante privacidade dos dados, custo zero por requisição e baixa latência — o mapa coberto é o **Brasil inteiro** (dados OSM).

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
| Mapa | Brasil (Geofabrik, PBF ~2 GB + grafo ~16 GB — configurável via `OSRM_EXTRACT`) |
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
│ API — Fastify (porta 8888)                   │
│  ├ helmet · CORS origin=false · sensible     │
│  ├ rate-limit (por uid / IP)                 │
│  ├ Firebase Auth — JWT RS256 (JWKS)          │
│  └ zod (validação de entrada/config)         │
└──────────────────────┬───────────────────────┘
                       │ HTTP (rede docker)
┌──────────────────────▼───────────────────────┐
│ OSRM backend (porta 5000, só 127.0.0.1)      │
│  GET /route/v1/motorcycle/{lng1},{lat1};…    │
│  perfil: osrm/profiles/motorcycle.lua        │
└──────────────────────────────────────────────┘
```

> Porta da API configurável via `PORT` (default `3000`; o compose e os exemplos usam `8888`, já que `3000` costuma estar ocupado por outro serviço).

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

> A primeira preparação do grafo do **Brasil** baixa **~2 GB** (Geofabrik `brazil-latest.osm.pbf`) e gera **~16 GB** de grafo `.osrm` — **~18 GB no total** — exigindo **~20 GB de RAM** e **1–2 h**. Os dados ficam em `OSRM_DATA_DIR` (bind mount no host) e são reutilizados nas execuções seguintes — veja [Dados do mapa (PBF + grafo OSRM)](#dados-do-mapa-pbf--grafo-osrm).

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

Sobe **API + OSRM** juntos. A API compila e roda dentro do container. Na **primeira vez**, o compose baixa o PBF e prepara o grafo antes de subir o servidor — **demora de 1 a 2 h** (veja [Dados do mapa (PBF + grafo OSRM)](#dados-do-mapa-pbf--grafo-osrm)):

```bash
docker compose up -d --build
docker compose logs -f osrm-prepare   # acompanha download + extração
docker compose ps                      # aguarde osrm "Up (healthy)"
```

- API: `http://localhost:8888`
- Health check: `curl http://localhost:8888/health`
- OSRM: `http://127.0.0.1:5000` (publicado **apenas** em localhost, rede interna)

### Opção B — API local + OSRM no Docker (desenvolvimento)

```bash
# 1. Sobe o OSRM (download + extract/partition/customize na 1ª vez)
docker compose up osrm

# 2. API em modo dev (tsx watch, aponta para http://localhost:5000)
npm run dev
```

> Na 1ª vez, `docker compose up osrm` **baixa o PBF e prepara o grafo** (1–2 h); nas demais, sobe o servidor em segundos.

### Sem Firebase (desenvolvimento/testes)

No `.env`:

```env
AUTH_DISABLED=true
```

Com isso, todas as rotas ficam abertas e o rate limit passa a usar o **IP** como chave (em vez do `uid`). A flag é **recusada em produção**: com `NODE_ENV=production`, o servidor não sobe com `AUTH_DISABLED=true`.

## Dados do mapa (PBF + grafo OSRM)

O motor de rota consome dois conjuntos de arquivos, todos dentro de `OSRM_DATA_DIR`:

| Conjunto | Arquivo(s) | Tamanho (Brasil) | Produzido por |
| --- | --- | --- | --- |
| Mapa bruto | `brazil-latest.osm.pbf` | **~2 GB** | `osrm-download` (Geofabrik) |
| Grafo de rota | `brazil-latest.osrm*` (~27 arquivos) | **~16 GB** | `osrm-prepare` |
| **Total** | | **~18 GB** | |

### Onde salvar

Defina `OSRM_DATA_DIR` no `.env` apontando para um disco com **pelo menos ~20 GB livres** — de preferência um HD/SSD grande de dados, **não o disco do sistema**:

```env
OSRM_DATA_DIR=/media/SEU_USUARIO/Dados/mapa-data
```

Como é um **bind mount** no host, os arquivos **não** são apagados por `docker compose down -v` — só com `rm` manual.

### Primeira execução

1. Configure `OSRM_DATA_DIR` (e, se quiser outra região, `OSRM_EXTRACT` + `OSRM_PBF_URL`) no `.env`.
2. Suba a stack. Na primeira vez o compose **baixa ~2 GB e processa o grafo (~16 GB)** — leva **1–2 h** e usa **~20 GB de RAM**:

   ```bash
   docker compose up -d --build
   docker compose logs -f osrm-prepare
   ```

3. Aguarde a preparação terminar e confira:

   ```bash
   docker compose ps                      # osrm: "Up (healthy)"
   curl "http://127.0.0.1:5000/route/v1/motorcycle/-46.6333,-23.5505;-43.1964,-22.9068?overview=false"
   ```

> **Docker Desktop:** se a preparação morrer com `Killed` (OOM), aumente a memória da VM para **≥ 24 GB** (Settings → Resources → Memory) e rode o `osrm-prepare` de novo — o PBF já baixado **não é re-baixado** e o processamento retoma de onde parou.

### Execuções seguintes (mapa já preparado)

Os serviços `osrm-download` e `osrm-prepare` detectam o PBF/grafo existentes e **saem imediatamente**; apenas o servidor sobe:

```bash
docker compose up -d osrm api
docker compose ps     # osrm "Up (healthy)"
```

### Atualizar o mapa

A Geofabrik atualiza o extrato do Brasil **diariamente**, mas para roteamento de moto **atualizar mensalmente** é um bom equilíbrio (mapa recente sem reprocessar toda semana):

```bash
# 1. Apagar o mapa atual (PBF + grafo)
rm -rf "${OSRM_DATA_DIR}"/brazil-latest.osm.pbf "${OSRM_DATA_DIR}"/brazil-latest.osrm*

# 2. Rebaixar e reprocessar (mesma "primeira execução", ~18 GB e 1–2 h)
docker compose up -d --build
docker compose logs -f osrm-prepare

# 3. Recarregar o grafo novo no servidor
docker compose up -d --force-recreate osrm
```

> **Dica (Docker Desktop):** se o `osrm-routed` reclamar de arquivos "Missing/Broken" logo após uma preparação, recrie o container para montar o grafo novo: `docker compose up -d --force-recreate osrm`.

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
| `OSRM_DATA_DIR` | `./.osrm-data` | Pasta no **host** onde o PBF e o grafo `.osrm` são baixados/gravados (bind mount em `/data`) |
| `OSRM_EXTRACT` | `brazil-latest` | Base do arquivo: espera `<EXTRACT>.osm.pbf` e gera `<EXTRACT>.osrm` |
| `OSRM_PBF_URL` | Geofabrik Brasil | URL de download do extrato OSM |
| `PARAM_OVERVIEW` | `full` | `full` \| `simplified` \| `false` |
| `PARAM_GEOMETRIES` | `geojson` | `geojson` \| `polyline` \| `polyline6` |
| `DEFAULT_PROFILE` | `motorcycle` | Perfil usado na URL do OSRM |
| `AUTH_ISSUER_URL` | — | **obrigatória** — issuer do JWT Firebase |
| `FIREBASE_PROJECT_ID` | derivado do issuer | Usado como `audience` do JWT |
| `FIREBASE_API_KEY` | — | **obrigatória** — Web API Key (pública) p/ signup/login |
| `AUTH_DISABLED` | `false` | Desativa validação JWT (só dev/testes; recusado em `production`) |
| `RATE_LIMIT_MAX` | `60` | Máximo de requisições por janela |
| `RATE_LIMIT_WINDOW` | `1 minute` | Janela do rate limit |

**Dados do mapa (OSRM):** o compose monta `OSRM_DATA_DIR` em `/data` nos 3 serviços de OSRM (`osrm-download` → `osrm-prepare` → `osrm-routed`). Como é um **bind mount** no host, `docker compose down -v` **não apaga** o grafo. Para trocar a região, mude `OSRM_EXTRACT` + `OSRM_PBF_URL` no `.env`:

```env
# Ex.: só o Rio Grande do Sul (openstreetmap.fr)
OSRM_EXTRACT=rio-grande-do-sul-latest
OSRM_PBF_URL=https://download.openstreetmap.fr/extracts/south-america/brazil/south/rio-grande-do-sul-latest.osm.pbf
```

A URL interna montada para o OSRM:

```text
{OSRM_URL}/route/v1/{DEFAULT_PROFILE}/{lng1},{lat1};{lng2},{lat2}?overview={PARAM_OVERVIEW}&geometries={PARAM_GEOMETRIES}&steps=false&alternatives=false
```

> **Atenção:** o OSRM espera `lon,lat`. A API pública recebe `lat,lng` e converte internamente (`src/utils/coordinates.ts`).

## API

### `GET /health` — público

```bash
curl http://localhost:8888/health
```

```json
{ "status": "ok", "service": "motor-route", "profile": "motorcycle" }
```

### Autenticação (pública) — obter o token

`POST /api/v1/auth/signup` — cria conta e retorna um **ID token** Firebase:

```bash
curl -X POST http://localhost:8888/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"rider@example.com","password":"secret123"}'
```

`POST /api/v1/auth/login` — autentica e retorna um **ID token** Firebase:

```bash
curl -X POST http://localhost:8888/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rider@example.com","password":"secret123"}'
```

Resposta (ambos):

```json
{
  "token": "eyJhbGciOi...",
  "refreshToken": "1//0g...",
  "expiresIn": "3600",
  "uid": "abc123"
}
```

| Campo | Descrição |
| --- | --- |
| `token` | ID token Firebase — use no header `Authorization: Bearer` |
| `refreshToken` | Para renovar o token via SDK/REST |
| `expiresIn` | Validade do token em segundos |
| `uid` | Identificador do usuário |

Essas rotas usam a **Web API Key** (`FIREBASE_API_KEY`) e são **públicas** (sem JWT). Erros comuns: `EMAIL_EXISTS` (409), `INVALID_CREDENTIALS` (401), `INVALID_EMAIL` (400), `WEAK_PASSWORD` (400), `TOO_MANY_ATTEMPTS` (429).

### `GET /api/v1/route?origin={lat,lng}&destination={lat,lng}` — autenticado

```bash
curl "http://localhost:8888/api/v1/route?origin=-29.7608,-50.0200&destination=-30.0346,-51.2177" \
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
| 400 | `INVALID_BODY` | Body de signup/login inválido |
| 400 | `INVALID_EMAIL` | Email inválido |
| 400 | `WEAK_PASSWORD` | Senha com menos de 6 caracteres |
| 401 | `MISSING_TOKEN` | Cabeçalho `Authorization` ausente |
| 401 | `INVALID_TOKEN` | JWT inválido/malformado |
| 401 | `TOKEN_EXPIRED` | JWT expirado |
| 401 | `INVALID_CREDENTIALS` | Email ou senha incorretos no login |
| 403 | `USER_DISABLED` | Conta de usuário desativada |
| 404 | `ROUTE_NOT_FOUND` | OSRM não encontrou rota entre os pontos |
| 409 | `EMAIL_EXISTS` | Email já cadastrado no signup |
| 429 | `RATE_LIMITED` | Limite de requisições excedido |
| 429 | `TOO_MANY_ATTEMPTS` | Firebase bloqueou tentativas repetidas |
| 502 | `OSRM_UNAVAILABLE` | OSRM inacessível ou resposta inválida |
| 502 | `FIREBASE_UNAVAILABLE` | Firebase Auth inacessível ou resposta inválida |
| 500 | `INTERNAL_ERROR` | Erro inesperado |

### Testando o fluxo completo (ponta a ponta)

Fluxo de teste com a API em `http://localhost:8888` e `AUTH_DISABLED=false`:

**1. Signup (cria conta)**

```bash
curl -X POST http://localhost:8888/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"novo.motoqueiro@example.com","password":"secret123"}'
```

**2. Login (obter token)**

```bash
curl -X POST http://localhost:8888/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rider@example.com","password":"secret123"}'
```

**3. Salvar o token para os próximos testes**

```bash
export TOKEN="<Token retornado no passo 2>"
```

Para os testes 4, 5 e 6 valerem (auth de verdade), reinicie a API antes com:

```bash
# Ctrl+C na API, depois:
AUTH_DISABLED=false PORT=8888 node --import tsx src/server.ts
```

**4. Rota SEM token → espera `401 MISSING_TOKEN`**

```bash
curl "http://localhost:8888/api/v1/route?origin=-29.7608,-50.0200&destination=-30.0346,-51.2177"
```

**5. Rota com token inválido → espera `401 INVALID_TOKEN`**

```bash
curl "http://localhost:8888/api/v1/route?origin=-29.7608,-50.0200&destination=-30.0346,-51.2177" \
  -H "Authorization: Bearer abcdef"
```

**6. Rota com token válido → espera `200` com distância/duração/geometry**

```bash
curl "http://localhost:8888/api/v1/route?origin=-29.7608,-50.0200&destination=-30.0346,-51.2177" \
  -H "Authorization: Bearer $TOKEN"
```

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
│   ├── controllers/
│   │   ├── routeController.ts    # GET /api/v1/route
│   │   └── authController.ts     # POST /api/v1/auth/signup + /login
│   ├── middlewares/auth.ts       # verificação JWT RS256 (JWKS)
│   ├── routes/
│   │   ├── route.ts              # rota protegida de roteamento
│   │   └── auth.ts               # rotas públicas de autenticação
│   ├── services/
│   │   ├── osrmService.ts        # cliente HTTP do OSRM + mapping da resposta
│   │   └── firebaseAuthService.ts# cliente Identity Toolkit (signup/login)
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