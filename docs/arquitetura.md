# Arquitetura da primeira versão

## Componentes

- **Netlify:** landing page e painel estático. O repositório publica `public/` e define cabeçalhos HTTP em `netlify.toml`.
- **Cloudflare Worker (`alpendre-gestao-api`):** API de saúde e leitura do resumo fictício. A interface consulta esse resumo e mantém fallback local caso a API não responda.
- **Cloudflare D1 (`alpendre-gestao-prod`):** esquema relacional multiempresa. As tabelas operacionais associam registros a uma organização; o seed atual contém somente a organização de demonstração.
- **Cloudflare R2:** ponto de integração previsto para arquivos privados. Bucket ainda não foi provisionado; nesta versão não existe upload de documentos.

## Fluxo de demonstração

1. O visitante abre a landing ou o painel sem conta de produção.
2. O painel usa fixtures locais para todos os módulos.
3. Uma chamada `GET /api/demo/summary` lê apenas totais das amostras fictícias no D1.
4. O Worker não expõe consultas por tenant nem escritas até existir uma sessão autenticada.
5. Alterações de demonstração ficam no `localStorage` daquele navegador; limpar os dados do site remove as alterações locais.

## Evolução de API

Rotas de produção devem autenticar a sessão no Worker, carregar associação ativa do usuário e usar a organização resolvida no servidor em todas as consultas. Os IDs recebidos do cliente são referências, não prova de autorização. Escritas devem validar esquema, papel, estado do projeto e origem, e então registrar o evento de auditoria junto à transação.

## Integrações externas previstas

Assinatura digital, e-mail, calendário, cobranças SaaS, emissão fiscal, DNS e armazenamento privado aparecem como pontos de configuração. Não há credenciais, chamadas de produção ou confirmação de disponibilidade de API nesta versão. RRT e licenças são acompanhadas manualmente; nenhuma integração oficial com CAU ou prefeituras é presumida.
