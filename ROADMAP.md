# Roadmap completo — Motor de rotas para motociclistas

## Visão estratégica

Este motor de rotas será a base do app mobile de mapas e deve cumprir estes objetivos principais:

- gerar rotas sem pagar por provider de rota
- priorizar segurança, qualidade e perfil de motociclista
- funcionar em todo o Brasil
- usar dados públicos e infraestrutura gratuita
- ser extensível para múltiplos mapas e providers
- suportar modos de viagem compartilhada e recuperação de rota

A arquitetura deve ser pensada como um motor de roteamento especializado, e não como um simples endpoint de rota.

---

## 1) Requisitos, recursos e tecnologias necessários para viabilizar a API

### 1.1 Infraestrutura principal

- Node.js 20+
  - runtime da API
  - link: https://nodejs.org/
- TypeScript
  - tipagem forte e manutenção mais segura
  - link: https://www.typescriptlang.org/
- Fastify
  - framework HTTP da API
  - link: https://www.fastify.io/
- Docker
  - execução local, testes e deploy
  - link: https://www.docker.com/
- Docker Compose
  - orquestração de serviços como OSRM, Redis, banco, etc.
  - link: https://docs.docker.com/compose/

### 1.2 Core de roteamento

- OpenStreetMap (OSM)
  - principal fonte de dados geográficos
  - link: https://www.openstreetmap.org/
- Geofabrik
  - download de arquivos OSM regionais
  - link: https://download.geofabrik.de/
- OSRM (Open Source Routing Machine)
  - motor de roteamento principal
  - link: https://project-osrm.org/
- OSRM profiles
  - perfil customizado para motociclista
  - link: https://github.com/Project-OSRM/osrm-backend/tree/master/profiles
- Postgres + PostGIS
  - armazenamento geográfico, filtros, análises e dados auxiliares
  - link: https://postgis.net/
- Redis
  - cache de rotas, geometrias e dados frequentes
  - link: https://redis.io/
- GeoJSON
  - formato padrão de geometria da rota
  - link: https://geojson.org/
- WGS84 / lat/lng
  - padrão de coordenadas do app e da API

### 1.3 Dados públicos e geográficos que serão necessários

- Dados do governo sobre áreas de risco / bairros / regiões de vigilância
  - dependem do município, estado e sistema público local
- Dados de infraestrutura viária do Brasil
  - rodovias federais, estaduais, vias pavimentadas, estradas secundárias
- Dados de qualidade de via
  - superfícies, pavimentação, características de estrada
- Dados de risco geográfico
  - perímetros de áreas críticas, zonas problemáticas, etc.
- Dados públicos de transportes e vias
  - disponibilizados por órgãos, municípios e portais abertos

Esses dados precisam ser transformados em:
- polígonos
- buffers
- pontos de risco
- classificações de via
- índices geográficos de segurança

### 1.4 Autenticação e segurança

- Firebase Authentication
  - opcional mas muito útil para autenticação do app
  - link: https://firebase.google.com/
- JWT / RS256
  - padrão para autenticação de usuários
  - sem depender de SDK do Firebase no servidor, se preferir
- Helmet / security middlewares
  - proteção da API
- Rate limiter
  - proteção contra abuso / excesso de requests
- CORS / proxy / API gateway
  - para controlar acesso externo e integrações

### 1.5 Providers externos opcionais e compatibilidade futura

Esses serviços NÃO são a base principal da rota, mas a API deve estar preparada para lidar com eles futuramente:

- Google Routes API
  - para compatibilidade com o ecossistema do Google
  - link: https://developers.google.com/maps/documentation/routes
- OpenRouteService
  - provider externo alternativo ou de comparação
  - link: https://openrouteservice.org/
- Mapbox Directions API
  - provider de referência
  - link: https://www.mapbox.com/
- HERE Routing API
  - possibilidade de comparação ou fallback
  - link: https://www.here.com/
- TomTom Routing API
  - provider de referência
  - link: https://developer.tomtom.com/

Importante:
- Esses providers só entram como compatibilidade futura ou comparação.
- O motor principal deve continuar sendo gratuito, local e controlado por você.

### 1.6 APIs e bibliotecas auxiliares

- Zod
  - validação de input e contratos
  - link: https://zod.dev/
- Pino / logger
  - logging e observabilidade
- Axios / fetch native
  - chamadas HTTP para serviços externos
- OpenAPI / Swagger
  - documentação da API
- Vitest / Jest
  - testes de integração e unitários
- ESLint / Prettier
  - qualidade de código

### 1.7 Serviços de hosting / deploy

- VPS Linux (DigitalOcean, Hetzner, AWS EC2, etc.)
  - para rodar OSRM, Redis, Postgres, API
- Cloud storage / object storage
  - para armazenar dados geográficos, snapshots, backups
- CDN / edge
  - opcional para API pública e cache geográfico
- Banco de dados gerenciado
  - opcional, mas não obrigatório para o MVP

### 1.8 Recursos de hardware / operação

- CPU e memória suficientes para processar o grafo do Brasil
- Disco local ou externo suficiente para armazenar o mapa
- Memória RAM adequada para OSRM e processamento geográfico
- Estrutura para rodovias interestaduais, dados do país inteiro e rotas de longa distância
- Arquitetura para rodovias e cruzamentos em grande escala

### 1.9 Principio de custo zero para geração da rota

Este é um princípio obrigatório do projeto:

- nenhuma rota principal deve depender exclusivamente de provider pago
- a operação deve ser sustentável sem pagar por cada requisição de rota
- o uso de dados públicos e open source deve ser a base da solução

---

## 2) Roadmap por fases

---

## Fase 0 — Fundação da arquitetura
Requisitos / recursos necessários:
- Node.js 20+
- TypeScript
- Fastify
- Docker / Docker Compose
- PostgreSQL + PostGIS
- Redis
- Git
- GitHub / CI
- Zod
- ESLint / Prettier
- Firebase Auth (opcional no início, mas recomendado)
- Observabilidade básica

### Objetivo
Preparar a API para crescer como um motor de roteamento especializado.

### Entregas
- estrutura de módulos e clean architecture
- separação em:
  - API layer
  - domain layer
  - provider adapters
  - data layer
  - geospatial layer
- interfaces de rota e contrato para app mobile
- autenticação e autorização
- logs estruturados
- versionamento da API
- base para multiplos providers e regras de negócio

### Resultado esperado
A API será preparada para evoluir sem virar um monólito rígido.

---

## Fase 1 — Base de roteamento gratuito e determinístico
Requisitos / recursos necessários:
- OpenStreetMap
- Geofabrik
- OSRM self-hosted
- Docker
- PostgreSQL + PostGIS
- Redis
- CPU/memória para grafo do Brasil
- Disco para armazenar os arquivos do mapa
- Node.js + TypeScript + Fastify

### Objetivo
Garantir a primeira rota funcional e gratuita.

### Entregas
- integração com OSRM self-hosted
- preparação do grafo do Brasil
- rota ponto a ponto básica
- rota nacional
- suporte a lat/lng
- conversão de coordenadas para o formato do provedor
- normalização da resposta em contrato próprio
- API pública para cálculo simples

### Resultado esperado
A API consegue gerar rotas de forma autonoma, sem depender de provider pago.

---

## Fase 2 — Perfis de motociclista e regras de roteamento
Requisitos / recursos necessários:
- OSRM perfil customizado
- OSM tags e classificações de vias
- Postgres + PostGIS
- Node.js + TypeScript
- Fastify
- Redis
- Dados de infraestrutura viária
- Modelos de contexto de deslocamento

### Objetivo
Implementar o diferencial principal do produto.

### Entregas
- perfil urbano
- perfil speed
- perfil big trail
- perfil offroad
- regras de preferências por tipo de viaje
- priorização de estrada pavimentada
- penalização de vias secundárias
- penalização de estradas perigosas
- priorização de rodovias

### Resultado esperado
A rota deixa de ser uma rota genérica e passa a refletir o comportamento de motociclistas.

---

## Fase 3 — Segurança geográfica e zonas perigosas
Requisitos / recursos necessários:
- dados públicos de risco
- georreferenciamento de bairros, áreas críticas e perímetros de risco
- Postgres + PostGIS
- Redis
- geoprocessamento e buffers
- bibliotecas GIS
- Node.js + TypeScript
- Fastify

### Objetivo
Evitar passagens por áreas de risco e zonas perigosas.

### Entregas
- mapa de zonas de risco
- polígonos e buffers geográficos
- regras de exclusão/penalização
- segurança geográfica no cálculo da rota
- comparação entre rota principal e rota mais segura
- metadados de risco da rota

### Resultado esperado
A API passa a priorizar segurança como critério da rota.

---

## Fase 4 — Rodovias pavimentadas e qualidade da via
Requisitos / recursos necessários:
- OSM tags de vias
- georreferenciamento de estradas
- Postgres + PostGIS
- geoprocessamento
- dados públicos de infraestrutura
- Node.js + TypeScript
- Fastify
- Redis

### Objetivo
Focar em vias principais, pavimentadas e adequadas para motociclista.

### Entregas
- classificação por tipo de via
- penalização de estradas secundárias
- priorização de rodovias e estradas federais
- penalização de vias de baixa qualidade
- critérios por perfil de motociclista
- decisões de rota orientadas por qualidade da via

### Resultado esperado
A rota se comporta como uma rota segura, direta e adequada para motociclista.

---

## Fase 5 — Waypoints e rotas multi-etapa
Requisitos / recursos necessários:
- OSRM self-hosted
- Node.js + TypeScript
- Fastify
- Redis
- Postgres + PostGIS
- geografia básica de rotas multi-etapa
- ferramentas de validação de waypoints

### Objetivo
Permitir viagens com pontos intermediários e trechos complexos.

### Entregas
- origem + destino + waypoints
- validação de pontos
- cálculo em múltiplos trechos
- resposta com:
  - legs
  - trechos
  - resumo
  - pontos de passagem
  - tempo por trecho
- metadados para app mobile

### Resultado esperado
A rota passa a servir de forma útil para viagens com escalas e paradas.

---

## Fase 6 — Alternativas de rota e escolha por critério
Requisitos / recursos necessários:
- OSRM self-hosted
- Node.js + TypeScript
- Fastify
- Redis
- Postgres + PostGIS
- lógica de ranking de rota
- algoritmos de comparação de itinerários

### Objetivo
Permitir escolha entre diferentes caminhos.

### Entregas
- múltiplas alternativas
- ordenação por:
  - tempo
  - distância
  - segurança
  - qualidade da via
  - perfil do motociclista
- resposta com N alternativas
- ranking por qualidade

### Resultado esperado
O app mobile pode mostrar opções de rota com critérios diferentes.

---

## Fase 7 — Cache, performance e escalabilidade
Requisitos / recursos necessários:
- Redis
- Node.js + TypeScript
- Fastify
- Docker
- Kubernetes / orchestration opcional
- by-region cache
- monitoração
- análise de latência

### Objetivo
Resolver gargalo de performance em rotas frequentes.

### Entregas
- cache por rota repetida
- cache por região
- cache de geometrias
- TTL configurável
- precompute de áreas de alto uso
- geohash / grid para reutilização de rota
- latência controlada
- monitoramento por endpoint e perfil

### Resultado esperado
Escala do sistema sem quebrar em alta demanda.

---

## Fase 8 — Modo compartilhado: recuperação da rota
Requisitos / recursos necessários:
- rastreamento de geolocalização em tempo real
- banco de dados para estado de viagem
- Redis
- geolocalização em tempo real
- Node.js + TypeScript
- Fastify
- gestão de rota compartilhada
- mecanismos de correção de rota

### Objetivo
Permitir que quem se perdeu do grupo consiga encontrar o grupo.

### Entregas
- rota original imutável
- ponto de referência da rota original
- rota de correção
- recalculo contínuo
- limiar de deslocamento da rota original
- reagrupamento do usuário ao caminho principal

### Resultado esperado
O app consegue recuperar usuários desviados sem perder a rota principal.

---

## Fase 9 — Recuperação em loop e continuidade da correção
Requisitos / recursos necessários:
- geolocalização em tempo real
- Redis
- Node.js + TypeScript
- Fastify
- mecanismo de correção de rota
- lógica de “recovery loop”

### Objetivo
Continuar recalculando e corrigindo a rota do usuário até ele reencontrar o grupo.

### Entregas
- loop de correção
- recalculo contínuo
- regras para sair do loop
- recuperação automática até reconexão

### Resultado esperado
A navegação em grupo se torna robusta e funcional.

---

## Fase 10 — Dados públicos, qualidade de via e geografia avançada
Requisitos / recursos necessários:
- OSM
- dados públicos de infraestrutura
- Postgres + PostGIS
- Redis
- geoprocessamento
- Node.js + TypeScript
- Fastify

### Objetivo
Reforçar a qualidade da rota com informações geográficas mais refinadas.

### Entregas
- classificação da qualidade de vias
- índices de infraestrutura
- mapeamento de áreas rurais e urbanas
- dados de superfície e acesso
- regras de negócio mais refinadas

### Resultado esperado
A rota entende melhor o que é qualidade, segurança e transitabilidade.

---

## Fase 11 — Cobertura nacional e escalabilidade geográfica
Requisitos / recursos necessários:
- dados OSM do Brasil inteiro
- OSRM self-hosted
- Postgres + PostGIS
- Redis
- infraestrutura de processamento geográfico
- Node.js + TypeScript
- Fastify
- VPS / cloud

### Objetivo
Preparar o sistema para trabalhar em todo o Brasil, especialmente em rotas interestaduais.

### Entregas
- partição de dados por região / estado
- suporte a múltiplos estados e regiões
- roteamento nacional escalável
- preparação para longas distâncias
- qualidade de rota consistente em qualquer região

### Resultado esperado
O sistema funciona de forma estável em todo o território nacional.

---

## Fase 12 — Produção, observabilidade e hardening
Requisitos / recursos necessários:
- monitoramento
- logs centralizados
- alertas
- backup
- rate limiting
- observabilidade
- Node.js + TypeScript
- Fastify
- Redis
- Postgres + PostGIS
- VPS / cloud
- CI/CD

### Objetivo
Preparar a API para uso em produção.

### Entregas
- circuit breaker
- retry inteligente
- monitoramento e alertas
- dashboards de performance
- segurança e auditoria
- backups e recuperação
- política de retenção
- tuning de produção

### Resultado esperado
A API estará pronta para operar como infraestrutura crítica de mobilidade.

---

## Prioridade real de implementação

### Prioridade máxima
- Fase 0 — Fundação
- Fase 1 — Roteamento gratuito e base
- Fase 2 — Perfis de motociclista
- Fase 3 — Segurança geográfica
- Fase 4 — Rodovias pavimentadas
- Fase 5 — Waypoints
- Fase 8 — Modo compartilhado / recuperação da rota

### Prioridade alta
- Fase 6 — Alternativas de rota
- Fase 7 — Cache, performance e escalabilidade
- Fase 9 — Loop de correção
- Fase 10 — Qualidade de via e geografia avançada
- Fase 11 — Cobertura nacional

### Prioridade baixa
- Fase 12 — Produção e hardening

---

## Conclusão

A API de rotas não deve ser tratada como um simples serviço de engenharia de rota. Ela deve funcionar como um motor especializado para motociclistas, com foco em:

- segurança geográfica
- qualidade da via
- perfil do usuário
- prioridade por rodovias e estradas adequadas
- operação gratuita
- uso de dados públicos
- suporte a viagens compartilhadas
- recuperação de rota em caso de desvio

Essa combinação transforma a API em um diferencial real para o app mobile e para o produto final.

Se quiser, no próximo passo eu posso fazer um dos dois:

1. transformar essa roadmap em uma arquitetura técnica detalhada com endpoints, DTOs e módulos
2. começar a implementação da primeira fase crítica:
   - base do roteamento gratuito
   - arquitetura com provider abstraction
   - suporte a waypoints
   - contrato da API para app mobile
