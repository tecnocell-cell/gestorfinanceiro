# Gestor Financeiro

Painel web de gestão financeira (BI) — React + Vite, com API opcional para sincronização com Microsoft Access.

## Desenvolvedor

**Gianderson F J.**  
- E-mail: giandersonfjs@gmail.com  
- Telefone: +55 94 98140-6316  

## Repositório

https://github.com/tecnocell-cell/gestorfinanceiro

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/INSTALACAO_PROXMOX.md](docs/INSTALACAO_PROXMOX.md) | Instalação em container LXC no Proxmox (Nginx + systemd) |
| [docs/ROADMAP_PROFISSIONAL.md](docs/ROADMAP_PROFISSIONAL.md) | Próximos passos para produto completo |
| [deploy/](deploy/) | Exemplos Nginx, systemd e script de atualização |

## Requisitos

- Node.js 18+
- (Opcional) Driver ODBC para Access, se usar `npm run server` — **somente Windows**

## Instalação local

```bash
npm install
```

## Executar

```bash
# Apenas frontend
npm run dev

# Frontend + API Access
npm run dev:all
```

## Build

```bash
npm run build
```

## Funcionalidades

- Dashboard, lançamentos, DRE, contas, plano de contas
- Clientes, fornecedores, importações (OFX, CSV, XLSX, Domínio, JSON)
- Conciliação, balancete, relatórios, empresa/banco
