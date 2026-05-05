# TSD

Monorepo das aplicações internas TSD.

## Estrutura

```
TSD/
├── apps/
│   ├── crono-app/    # App de cronograma (React + Vite)
│   └── prompt-hub/   # Hub de prompts (React + Vite + Express + Higgsfield/Anthropic)
├── package.json      # workspaces npm
└── README.md
```

## Requisitos

- Node.js >= 20
- npm >= 10 (suporte a workspaces)

## Setup

```bash
# Na raiz do repo
npm install
```

O `npm install` na raiz instala dependências de todos os workspaces.

## Scripts

Da raiz do monorepo:

| Comando              | O que faz                                       |
| -------------------- | ----------------------------------------------- |
| `npm run dev:crono`  | Sobe o dev server do `crono-app`                |
| `npm run dev:hub`    | Sobe Vite + Express do `prompt-hub`             |
| `npm run build`      | Builda todos os apps que têm script `build`     |
| `npm run build:crono`| Builda apenas o `crono-app`                     |
| `npm run build:hub`  | Builda apenas o `prompt-hub`                    |
| `npm run lint`       | Roda lint em todos os apps que têm o script     |

Também é possível entrar em cada app diretamente:

```bash
cd apps/crono-app && npm run dev
cd apps/prompt-hub && npm run dev
```

## Apps

### crono-app

App de cronograma com exportação para PDF/Excel. Stack: React 19, Vite 8, date-fns, jspdf, html2canvas, xlsx.

### prompt-hub

Hub para gerar mídias via Higgsfield e conversar com a Anthropic API. Stack: React 18, Vite 5, Express, Tailwind v4, `@anthropic-ai/sdk`, `@higgsfield/client`.

Variáveis de ambiente esperadas em `apps/prompt-hub/.env` (ver `.env.example`):

- `ANTHROPIC_API_KEY`
- `HF_CREDENTIALS`

## Segurança

- Nunca commitar arquivos `.env` reais — use `.env.example` como referência.
- Sessões locais (`.hf_session.json`) estão no `.gitignore`.
