# LIVRIA 0.1.0

Biblioteca comunitária e rede social literária em português, com frontend React/TypeScript/Vite compartilhado com Android por Capacitor. Backend exclusivo Supabase, separado do projeto RPG existente.

**Esta é uma primeira versão funcional para avaliação. O escopo completo do prompt mestre ainda não foi concluído.** Veja [docs/STATUS.md](docs/STATUS.md) para testes, limitações e pendências.

## Executar no computador

Requer Node.js 24 e npm.

```bash
npm ci
npm run dev
```

Abra o endereço impresso pelo Vite. O frontend já contém a URL e a chave **publicável** do projeto LIVRIA criado nesta execução. Nenhuma chave administrativa fica no cliente. Para usar outro projeto, copie `.env.example` para `.env.local`, ajuste os valores, aplique as migrações e publique as funções.

```bash
npm test
npm run build
npm run preview
```

`dist/` é o site estático final. Sirva-o por HTTP/HTTPS; não abra `index.html` diretamente pelo explorador de arquivos. O roteamento usa hash para funcionar no GitHub Pages com atualização de página e links profundos. O service worker mantém a interface em cache; não armazena respostas autenticadas do Supabase nem baixa PDFs privados automaticamente.

## Android

No pacote de entrega, `LIVRIA-0.1.0-debug.apk` é o APK de desenvolvimento compilado e assinado. Compatibilidade mínima Android 7 (API 24), conforme Capacitor 8; renderização do PDF também depende de um Android System WebView atualizado. Não houve teste de instalação em celular ou emulador.

O projeto nativo completo está em `android/`. Para compilar no GitHub, use o workflow **Build Android APK**. Os detalhes estão em [docs/OPERACAO.md](docs/OPERACAO.md). Não é necessário instalar Android Studio no computador do proprietário.

## Organização

| Local | Conteúdo |
| --- | --- |
| `src/pages` | Catálogo, contas, leitor, perfis, feed, chat, clubes, métricas, administração |
| `src/components` | Navegação, cartões e componentes de interface |
| `src/lib` | Cliente Supabase, autenticação, arquivos, cálculos e fila offline |
| `src/features` | Camada de texto PDF.js isolada do restante da interface |
| `supabase/migrations` | Esquema, índices, RLS, triggers, RPCs e buckets reproduzíveis |
| `supabase/functions` | Validação de PDF e exportação/exclusão autenticada de conta |
| `.github/workflows` | Verificação, compilação Android e publicação aprovada no Pages |
| `tests` | Testes unitários e de integração com contas descartáveis |
| `docs` | Operação, arquitetura, status e resultados dos testes reais |

## Segurança e operação

PDFs ficam em bucket privado e exigem autorização. Fotos e banners respeitam a privacidade do perfil. Capas são públicas; não envie uma capa que contenha informações pessoais ou confidenciais. Livros comunitários dependem de revisão. A leitura privada não gera publicações automáticas. Dados de chat são limitados aos participantes; não há criptografia ponta a ponta.

O cliente nunca deve receber `service_role`, segredo de assinatura ou senha de banco. As funções de conta e validação verificam o token com `auth.getUser()` antes de usar permissões administrativas no servidor. O painel de moderação exige cadastro protegido em `private.admins`, sem atribuição de papel por metadados de usuário.

Não execute os testes de integração contra contas reais. Use somente um projeto de QA isolado e contas marcadas como descartáveis. O teste pode excluir essas contas e seus arquivos.

## Desenvolvimento no repositório compartilhado

A fonte fica em `livria/`, na branch `livria/desenvolvimento` do repositório `MegaDev13/asdas`. Os workflows ativos ficam na raiz em `.github/workflows/livria-ci.yml` e `livria-android.yml`; os exemplos dentro de `livria/.github/workflows` servem à futura extração para um repositório dedicado. Para executar localmente, entre primeiro em `livria/`.

## Próximas dependências externas

1. Verificar os artefatos gerados pelos workflows próprios desta branch.
2. Configurar o URL final em Supabase Auth e testar confirmação e recuperação por e-mail.
3. Executar o workflow Android no GitHub e revisar o APK em um aparelho.
4. Aprovar a primeira publicação pública antes de executar o workflow do Pages.

A branch foi autorizada pelo proprietário para desenvolvimento isolado. O conteúdo anterior e a branch principal do repositório ficam preservados. O site público existente não será substituído automaticamente.
