# Changelog - BombCrypto Data Engine v2

Todas as mudanças notáveis para o projeto `bombstats-api` serão documentadas neste arquivo. 
A arquitetura foi completamente refatorada para suportar a ingestão de dados em altíssima escala com resiliência a quedas de RPC e banco de dados particionado.

## [2.0.0] - Refatoração Completa (Data Engine V2)

### 🚀 Adicionado (Added)
- **Fastify Core:** Migração do Express para o `@nestjs/platform-fastify`, aumentando significativamente o *throughput* de requisições por segundo na API.
- **Viem Multi-Transport (`viem.service.ts`):** Substituição completa da lógica de scraping manual por indexação on-chain utilizando a biblioteca moderna `viem`.
- **Fallback Rotation para RPCs:** Implementada uma rotação automática de *endpoints* RPC (LlamaRPC, Ankr, Binance, etc.) nativa do Viem para imunidade contra limites de taxa (*Rate Limits*). Nenhuma chave de API privada é necessária.
- **Workers Assíncronos (BullMQ):** Separação da lógica de ingestão em filas background independentes para a rede Binance Smart Chain (`ingestion-bsc`) e Polygon (`ingestion-polygon`), processadas via Redis.
- **Trava Anti-Reorg:** O Worker da rede Polygon agora trabalha sempre respeitando uma margem de segurança de `HEAD - 128 blocos`, garantindo proteção absoluta contra reorganizações de cadeia (blocos órfãos).
- **PostgreSQL Partitioning:** Implementado particionamento nativo por lista (`PARTITION BY LIST`) na tabela `nfts`, separando dados da BSC e da Polygon em nível de disco para prevenir gargalos de I/O em consultas massivas (Table Scans).
- **Cursor Pagination:** Rota `GET /nfts` reconstruída utilizando paginação baseada em cursor indexado (`token_id`), eliminando a latência quadrática do uso de `OFFSET` tradicional.
- **Camada de Cache Redis (`ioredis`):** Respostas de API cacheadas em memória com TTL dinâmico (5 segundos) para suportar milhares de usuários simultâneos consultando dados recentes.
- **Docker Compose (`docker-compose.yml`):** Orquestração completa adicionada na raiz para levantar as instâncias de desenvolvimento do PostgreSQL 15 e Redis 7 com um único comando.
- **Quality Assurance (QA):** 
  - Suite de Smoke Tests (E2E) via Jest em `test/app.e2e-spec.ts`.
  - Scripts de Load/Stress Test criados utilizando `k6` (`test/load/k6-stress-test.js`).
  - GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`) para validação de Testes e Linting em cada PR.
  - Script de segurança (`npm run security:audit`) mapeado no `package.json`.

### 🧹 Removido (Removed)
- **Web3.js Obsoleto:** A biblioteca `web3` antiga foi inteiramente erradicada devido ao peso, baixa performance em indexação e instabilidade nas versões legadas.
- **Ferramentas de Web Scraping:** Dependências de scraping como `cheerio`, `free-proxy`, `proxy-lists`, `https-proxy-agent` foram limpas, eliminando vetores graves de segurança.
- **Dependências Inúteis:** Remoção de pacotes como `alchemy-sdk`, `opensea-js`, `@opensea/stream-js` e `sfs2x-api`.
- **Módulos e Repositórios Legados:** Todas as pastas internas `src/modules`, `src/services`, `src/database/repositories` e `src/database/models` antigas foram deletadas. O fluxo síncrono e centralizado legado foi completamente aposentado.
- **Segredos Hardcoded:** Limpeza profunda de segredos, IPs, chaves privadas ou URLs expostas dentro do código-fonte e migração para o padrão de leitura exclusiva por variáveis de ambiente (`process.env`).
