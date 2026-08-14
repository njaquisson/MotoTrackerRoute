# MotorRoute Web — Frontend de demonstração

Aplicação **React + Vite + Leaflet** que consome a API de roteamento [`GET /api/v1/route`](../../README.md#get-apiv1routeoriginlatlngdestinationlatlng--autenticado) e desenha a geometria da rota no mapa.

É o **cliente de teste** do MotorRoute: serve para validar o contrato da API e visualizar o resultado do perfil `motorcycle` do OSRM (mapa: Rio Grande do Sul).

## Stack

| Camada | Tecnologia |
| --- | --- |
| UI | React 18 + TypeScript |
| Mapa | Leaflet + react-leaflet |
| Build | Vite (dev server com proxy) |

## Pré-requisitos

- Node.js **20+**
- A **API MotorRoute rodando** (veja o [README principal](../../README.md)) — este projeto apenas consome a API.

## Instalação

```bash
cd examples/web
npm install
```

## Como rodar

A API e o frontend rodam em **paralelo**, em terminais separados.

### 1. API na porta `8888`

A API precisa estar acessível em `http://127.0.0.1:8888` (padrão esperado pelo proxy do Vite). Na raiz do repositório:

```bash
AUTH_DISABLED=true PORT=8888 npm run dev
```

> `AUTH_DISABLED=true` desativa o JWT — o frontend não envia `Authorization`. Para testar com autenticação real, ajuste o proxy para a porta da API e adicione o token no cliente.

### 2. Frontend na porta `5173`

```bash
cd examples/web
npm run dev
```

Abra `http://localhost:5173`.

> **Problema de `vite: not found`?** Se `npm run dev` falhar com `sh: 1: vite: not found` (binário fora do PATH), execute diretamente pelo Node:
> ```bash
> node ./node_modules/vite/bin/vite.js
> ```

### Proxy do Vite

O Vite faz proxy de todas as chamadas a `/api` para a API (`vite.config.ts`). Isso evita erros de **CORS** no navegador.

- Padrão: `http://127.0.0.1:8888`
- Para apontar para outra porta:

```bash
API_PROXY_TARGET=http://127.0.0.1:3000 node ./node_modules/vite/bin/vite.js
```

## Uso

1. Preencha **Origem** e **Destino** no formato `lat,lng` (ex.: `-30.0346,-51.2177`).
2. Clique em **Gerar Rota**.
3. O painel exibe **distância** e **duração**; a geometria `LineString` é desenhada no mapa (com auto-zoom).
4. Padrão inicial: Capão da Canoa → Porto Alegre.

> **Coordenadas:** a API retorna GeoJSON no formato `[lng, lat]`. O frontend converte para `[lat, lng]` (esperado pelo Leaflet) em `src/geo.ts` antes de desenhar.

## Build de produção

```bash
cd examples/web
npm run build
```

Gera o bundle estático em `examples/web/dist` (tsc + vite build). Para pré-visualizar:

```bash
npm run preview
```

## Estrutura

```text
examples/web/
├── index.html
├── vite.config.ts            # proxy /api → API (API_PROXY_TARGET)
├── package.json
└── src/
    ├── main.tsx              # bootstrap React
    ├── App.tsx
    ├── api.ts                # cliente do GET /api/v1/route
    ├── geo.ts                # [lng,lat] → [lat,lng], formatação de distância/duração
    ├── types.ts              # contratos da resposta
    └── components/
        └── MapComponent.tsx  # mapa Leaflet + formulário
```

## Relação com o repositório

Este é um dos dois projetos do repositório:

| Projeto | Pasta | Função |
| --- | --- | --- |
| **motor-route** (API) | raiz | Cálculo de rotas via OSRM + auth Firebase |
| **motor-route-web** (cliente) | `examples/web` | Consumo e visualização das rotas |