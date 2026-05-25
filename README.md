# Gestor Financeiro

Sistema web de gestão financeira SaaS — suporte a **Pessoa Física** e **Pessoa Jurídica**, multi-usuário, com autenticação JWT e armazenamento em PostgreSQL.

**Stack:** React 19 + Vite 8 + Express 5 + PostgreSQL 16

## Desenvolvedor

**Gianderson F J.**  
- E-mail: giandersonfjs@gmail.com  
- Telefone: +55 94 98140-6316

---

## 🚀 Deploy rápido no Proxmox LXC (Ubuntu 22.04)

```bash
# 1. Clone o repositório dentro do container
git clone https://github.com/tecnocell-cell/gestorfinanceiro.git
cd gestorfinanceiro

# 2. Execute o script de instalação automática
chmod +x setup.sh
sudo ./setup.sh
```

O script instala Node.js 20, PostgreSQL 16, configura o banco, gera o build do React e inicia com PM2.

Acesse pelo IP do container na porta **3001**.

---

## 🐳 Deploy com Docker Compose

```bash
# 1. Configure a chave secreta JWT
cp .env.example .env
# Edite .env e troque JWT_SECRET por algo seguro

# 2. Suba os containers
docker compose up -d --build

# 3. Verifique
docker compose ps
docker compose logs app
```

Acesse: `http://localhost:3001`

---

## 💻 Desenvolvimento local

```bash
# Instala dependências
npm install

# Terminal 1 — servidor Express (PostgreSQL)
npm run server

# Terminal 2 — Vite dev server (proxy /api → :3001)
npm run dev
```

Requer PostgreSQL local. Configure `DATABASE_URL` no `.env` (copie `.env.example`).

---

## 📦 Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `postgresql://gestor:gestor123@localhost:5432/gestor_db` | Conexão PostgreSQL |
| `DATABASE_SSL` | `false` | SSL para o banco |
| `JWT_SECRET` | *(gerado no setup)* | Chave de assinatura JWT — **troque em produção!** |
| `PORT` | `3001` | Porta do servidor |
| `NODE_ENV` | `production` | Ambiente |

---

## 📋 Comandos úteis (PM2)

```bash
pm2 status           # Status dos processos
pm2 logs gestor      # Logs em tempo real
pm2 restart gestor   # Reiniciar app
pm2 stop gestor      # Parar app
```

---

## Funcionalidades

**Pessoa Jurídica (PJ)**
- Dashboard, lançamentos, DRE, balancete, fluxo de caixa
- Plano de contas, contas bancárias, clientes, fornecedores
- Fechamento de período, consulta DRE, relatórios, importações

**Pessoa Física (PF)**
- Dashboard pessoal, lançamentos simplificados
- Categorias (receita/despesa), orçamento por categoria
- Metas de poupança com progresso, relatórios de gastos

**Multi-perfil:** crie quantos perfis PF/PJ quiser na mesma conta.
