# Arquitetura

Um frontend React 19/TypeScript 7/Vite 8 serve o navegador e é empacotado pelo Capacitor 8 para Android. React Router usa hash; TanStack Query controla consultas e cache de interface. As versões exatas estão em `package.json` e `package-lock.json`.

PostgreSQL/Supabase é a fonte de dados de usuários, catálogo, estantes, progresso, anotações, áudio, feed, conversas e clubes. Auth mantém as identidades; o trigger de cadastro cria perfil e preferências sem conceder privilégios. O modelo é normalizado por relacionamento de usuário/obra; arquivos PDF não são replicados por leitor.

## Fronteiras de autorização

- RLS em todas as tabelas públicas. Grants de coluna impedem alterações diretas em status de livros e identidades de mensagens.
- Helpers de autorização em `private`, com `search_path` vazio, nomes qualificados e privilégios mínimos. RPCs públicas chamam operações autenticadas específicas.
- Conversas e associação de membros são criadas atomicamente por RPC. Um cliente não insere participantes arbitrários.
- Usuários de clubes públicos ingressam apenas como membros. Convites privados exigem aceitação da conta destinatária.
- URLs assinadas duram 15 minutos. A URL já emitida é uma credencial temporária; uma revogação de acesso não apaga cópias que já tenham sido baixadas.
- Sem `service_role` ou credenciais de banco no frontend/APK. As únicas operações administrativas automáticas ficam nas Edge Functions autenticadas.
- Sem HTML de usuário executado: publicações, notas e mensagens são renderizadas como texto pelo React. PDF.js renderiza canvas e camada de texto; o aplicativo não executa ações JavaScript do documento.

## Leitor

PDF.js é carregado separadamente com worker local. O PDF fiel tem camada de texto selecionável; destaques guardam retângulos normalizados por página, trecho e comentário. A seleção precisa começar e terminar na mesma página. Na rotação padrão, os retângulos acompanham o zoom; destaques são ocultados na rotação alternativa até o retorno à orientação original. Em documentos escaneados sem texto, a busca e a síntese de voz ficam indisponíveis. OCR ainda não foi incluído.

A rolagem usa placeholders e IntersectionObserver para renderizar somente páginas próximas. O modo de texto usa o conteúdo extraído separadamente da página fixa. Há paginação, rolagem, duas páginas em telas amplas, zoom, rotação, busca por páginas, sumário disponível no PDF, seleção, notas, marcadores e exportação JSON.

O progresso usa controle otimista por timestamp retornado pelo servidor. Uma gravação obsoleta retorna `null`, preserva a posição local e evita sobrescrever a posição mais recente sem avisar. A fila IndexedDB conserva inserções de notas, destaques e marcadores por usuário e repete operações idempotentes ao reconectar. A recuperação completa de arquivos PDF após fechar o aplicativo offline ainda não está implementada.

## Áudio

Web Speech no navegador; plugin TextToSpeech no Android. A narração percorre segmentos e páginas. O painel mostra o segmento atual, sem prometer alinhamento palavra a palavra sobre PDFs complexos. A Web permite pausa/continuação; no Android a interrupção retoma a página. A posição de áudio gravado é persistida separadamente em `audio_progress`.

## Métricas

Heartbeats de 15 segundos são emitidos somente para páginas visíveis com interação recente. O servidor força o timestamp, limita a duração e bloqueia rajadas. Isso reduz contagens artificiais, mas não comprova que o usuário leu ou compreendeu uma página. O produto apresenta páginas visitadas e tempo estimado, com fuso da Bahia.

## Realtime

Mudanças de mensagens usam histórico PostgreSQL e eventos filtrados por RLS. Typing usa Broadcast em canais privados com política de participação. Os clientes removem as subscriptions ao sair das telas. Feed, discussões e notificações recebem eventos relevantes; o progresso não transmite cada movimento da rolagem.

## Desempenho e custos

Rotas carregam sob demanda, catálogos e históricos são paginados e arquivos têm limites. Índices cobrem buscas, relacionamentos e ordem temporal. O projeto inicia sem conteúdo de catálogo e respeita os limites do plano Supabase. Consumo, capacidade e cobranças não são ilimitados; acompanhe Database, Storage, egress, Auth e Realtime no painel.

## Distribuição

GitHub armazena o código e executa builds; Supabase armazena o conteúdo dinâmico. Não há VPS ou servidor particular permanentemente ativo. O site usa `dist`; o aplicativo contém o mesmo build e o mesmo backend. O cache offline da interface não substitui as políticas de leitura nem faz cópias automáticas de obras.
