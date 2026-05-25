# Próximos passos — Gestor Financeiro profissional e completo

Roteiro priorizado para evoluir do **MVP web (~70% do núcleo BI da planilha Lacus)** para um **produto de produção** confiável.

Repositório: https://github.com/tecnocell-cell/gestorfinanceiro

---

## Situação atual (baseline)

| Área | Status |
|------|--------|
| Dashboard, DRE, lançamentos, contas, plano | ✅ Web |
| Clientes, fornecedores, import/export | ✅ Web |
| Conciliação, balancete, relatórios | ✅ Web |
| Multi-empresa (localStorage) | ✅ Básico |
| API Access (ODBC) | ✅ Só Windows |
| Persistência servidor | ❌ localStorage |
| Autenticação / permissões | ❌ |
| Paridade total planilha Excel/VBA | ❌ ~45% funcionalidades totais |

---

## Fase 1 — Produção estável (1–2 semanas)

Objetivo: rodar no Proxmox sem surpresas.

| # | Tarefa | Impacto |
|---|--------|---------|
| 1.1 | **Banco de dados no servidor** (PostgreSQL ou SQLite) substituir `localStorage` | Dados centralizados, backup real |
| 1.2 | **API REST completa** (CRUD lancamentos, contas, plano, clientes…) | Vários usuários no mesmo dado |
| 1.3 | **Variáveis de ambiente** (`PORT`, `DATABASE_URL`, `CORS_ORIGIN`) | Deploy previsível |
| 1.4 | **Docker Compose** (app + db + nginx) além do guia LXC | Replicação fácil |
| 1.5 | **Healthcheck** `/api/health` + log estruturado (pino/winston) | Monitoramento |
| 1.6 | **CI GitHub Actions** (lint + build em cada push) | Qualidade contínua |

**Entregável:** um comando sobe stack; dados não se perdem ao limpar o navegador.

---

## Fase 2 — Segurança e multiusuário (2–3 semanas)

| # | Tarefa | Impacto |
|---|--------|---------|
| 2.1 | **Login** (JWT ou sessão) + senha com bcrypt | Acesso controlado |
| 2.2 | **Perfis** (admin, operador, somente leitura) | Governança |
| 2.3 | **HTTPS obrigatório** + headers de segurança (CSP, HSTS) | Proteção na LAN/internet |
| 2.4 | **Auditoria** (quem alterou lançamento e quando) | Rastreabilidade contábil |
| 2.5 | **Rate limit** na API | Anti-abuso |

**Entregável:** equipe usa o mesmo sistema com logins diferentes.

---

## Fase 3 — Integração Lacus / Access (2–4 semanas)

| # | Tarefa | Impacto |
|---|--------|---------|
| 3.1 | **Serviço Windows** dedicado (ODBC) na rede, chamado pelo Linux | Sync `.accdb` real |
| 3.2 | **Mapeamento completo** tabelas `BC_*` do Access | Paridade com planilha |
| 3.3 | **Sync agendado** (cron: a cada 15 min / 1 h) | Dados sempre atualizados |
| 3.4 | **Migração gradual** Access → PostgreSQL | Independência do Windows |
| 3.5 | **Validação** de schema (campos obrigatórios, lotes) | Menos erro de importação |

**Entregável:** substituir fluxo “abrir Excel + apontar .accdb” por painel web sincronizado.

---

## Fase 4 — Funcionalidades da planilha ainda faltantes (contínuo)

Priorizar conforme uso real dos clientes Lacus:

| Módulo planilha | Prioridade sugerida |
|-----------------|---------------------|
| Orçamento / previsto vs realizado | Alta |
| Fluxo de caixa projetado | Alta |
| Emissão DRE gerencial por centro de custo | Alta |
| Integração Domínio contábil (export lotes) | Alta |
| Boletos / contas a pagar e receber com vencimento | Média |
| Conciliação bancária automática (OFX rules) | Média |
| Multi-CNPJ com troca rápida | Média |
| Relatórios PDF personalizados (logo empresa) | Média |
| Dashboard por filial / safra (agronegócio) | Baixa* |

\*Ajustar conforme negócio.

---

## Fase 5 — UX e produto profissional (1–2 semanas)

| # | Tarefa |
|---|--------|
| 5.1 | Design system (cores, tipografia, componentes reutilizáveis) |
| 5.2 | Tabelas com paginação, ordenação e filtros server-side |
| 5.3 | Atalhos de teclado e formulários com validação em tempo real |
| 5.4 | Modo escuro opcional |
| 5.5 | PWA (instalar como app no desktop/celular) |
| 5.6 | Onboarding (tour na primeira visita) |

---

## Fase 6 — Qualidade e operação (paralelo)

| # | Tarefa |
|---|--------|
| 6.1 | Testes unitários (`finance.js`, importações) |
| 6.2 | Testes E2E (Playwright: login → lançamento → DRE) |
| 6.3 | Documentação usuário (PDF ou wiki) |
| 6.4 | Versionamento semântico (tags `v1.1.0`) |
| 6.5 | Changelog automático |
| 6.6 | Ambiente **staging** no Proxmox (CT clone) |

---

## Stack recomendada (alvo)

```
Frontend:  React + Vite + TypeScript (migração gradual)
Backend:   Node.js + Express (ou Fastify)
Banco:     PostgreSQL 16
Cache:     Redis (sessões / fila sync)
Proxy:     Nginx ou Traefik
Auth:      JWT + refresh token
Deploy:    Docker Compose no LXC ou VM dedicada
Backup:    pg_dump diário + restic para NAS
```

---

## Ordem sugerida (resumo executivo)

1. **PostgreSQL + API** (parar de depender do navegador)  
2. **Login e perfis**  
3. **Deploy Docker + CI**  
4. **Sync Access via Windows**  
5. **Funcionalidades Lacus que faltam** (orçamento, fluxo de caixa, export Domínio)  
6. **Polish UX + testes + documentação**

---

## Métricas de “completo e profissional”

| Métrica | Meta |
|---------|------|
| Uptime API | > 99% na LAN |
| Tempo de resposta dashboard | < 2 s |
| Backup automático | Diário, testado restore mensal |
| Usuários simultâneos | ≥ 5 sem conflito de dados |
| Paridade planilha (núcleo financeiro) | ≥ 90% |
| Incidentes de perda de dados | 0 |

---

## Investimento estimado (referência)

| Fase | Esforço aproximado |
|------|-------------------|
| Fase 1 | 40–60 h |
| Fase 2 | 30–50 h |
| Fase 3 | 50–80 h |
| Fase 4 | 80–150 h (depende do escopo Lacus) |
| Fase 5–6 | 40–60 h |

---

## Contato / manutenção

**Gianderson F J.**  
- giandersonfjs@gmail.com  
- +55 94 98140-6316  

Para cada fase, abra **Issues** no GitHub com label `fase-1`, `fase-2`, etc., e marque entregas em **Milestones** (`v1.1`, `v1.2`…).

---

*Este roadmap é um guia vivo — revise a cada sprint com o que o negócio mais usa na planilha original.*
