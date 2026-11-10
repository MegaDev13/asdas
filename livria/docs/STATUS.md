# Entrega de avaliação — LIVRIA 0.1.0

Data: 10 de novembro de 2026. Esta entrega é uma primeira implementação funcional. **Ainda não atende a todos os itens do prompt mestre e não é uma versão de produção concluída.**

## Atualização GitHub — 10/11/2026

A fonte foi enviada à branch `livria/desenvolvimento` de `MegaDev13/asdas`. O workflow Web e o workflow Android passaram no commit `6e8a681f2240082c1b502015027b150b2a0c9723`. O APK do Actions foi baixado, teve a assinatura e SHA-256 conferidos e contém os mesmos 32 arquivos do artefato Web. Instalação física continua pendente. Os identificadores e links dos runs estão em `GITHUB-ACTIONS.json`; `BUILD.json` registra a compilação local anterior.

O primeiro run Android falhou porque `setup-android@v3` solicitava o pacote removido `tools`. Os workflows foram corrigidos para a versão atual, com `platform-tools` explícito, e o novo run passou.

## Implementado

| Área | Implementação nesta versão |
| --- | --- |
| Base | React, TypeScript, Vite, navegação por hash, rotas sob demanda, tema claro/escuro/sépia, layout desktop e mobile |
| Contas | Cadastro, login por senha, saída, recuperação/alteração de senha, persistência de sessão, exportação e exclusão autenticada |
| Perfis | Usuário único, nome, bio, frase, avatar, banner, cor, gêneros, perfil privado, seguidores, solicitações, bloqueios |
| Catálogo | Banco real, busca por título/autor, filtros, ordenação por data/título, detalhes, capas e ausência de dados simulados |
| Envios | PDF até 20 MB, origem/licença obrigatória, rascunho, validação estrutural no servidor, SHA-256, páginas, revisão de compartilhamentos |
| Estante | Quero ler, lendo, concluídos, abandonados e favoritos, sem duplicar os arquivos por leitor |
| Leitor | PDF.js, paginação, rolagem progressiva, duas páginas, zoom, rotação, tela cheia, texto selecionável, texto adaptável, busca e sumário quando disponível |
| Anotações | Marcadores, destaques com coordenadas normalizadas e trecho, notas de página, comentários de destaque, exclusão e exportação JSON |
| Progresso | Sincronização por usuário/obra, posição, modo, zoom e controle de concorrência contra sobrescritas antigas |
| Áudio | TTS Web e plugin Android, segmentos/páginas, voz/velocidade, narração gravada por capítulos, retomada, avanço/retrocesso e temporizador |
| Métricas | Sessões ativas estimadas, totais, dias, páginas distintas visitadas, sequência, gráfico de 14 dias e metas diária/anual |
| Social | Feed persistente, publicações, spoilers, curtidas, comentários, resenhas/estrelas, descoberta de leitores e atividade voluntariamente compartilhada |
| Mensagens | Histórico real, Realtime, envio, edição, exclusão, anexos de imagem, paginação, silenciamento, contagem de não lidas e digitação em canal privado |
| Clubes | Criação pública/privada, participação, convites com aceitação, membros, chat, tópicos, livro e data de leitura coletiva |
| Notificações | Central persistente e eventos de mensagem, seguidores e convites |
| Moderação | Revisão de livros e denúncias, operações restritas no backend e registro de decisões |
| Offline inicial | Interface em cache após build, preferências locais e fila IndexedDB de inserções de anotações por usuário |
| Distribuição | Projeto Android, APK debug real, workflows de testes, build Android, Pages com aprovação e rascunho de release assinada |

## Verificado

- Build TypeScript/Vite de produção: passou.
- 11 testes unitários: passaram, incluindo inatividade, limites, busca, links HTTPS, sequência de dias e preservação/isolamento da fila offline.
- 18 cenários de integração em `docs/live-test-results.json`: passaram.
- 6 cenários adicionais em `docs/extended-test-results.json`: passaram.
- Integração usou três contas descartáveis reais; não foram usados arrays locais para aparentar chat ou armazenamento.
- Autenticação por senha, edição de perfil, PDF válido enviado e analisado no servidor, download autorizado e bloqueio de terceiros: passaram.
- Marcadores, notas e retângulos de destaque privados persistentes: passaram no backend.
- Progresso rejeitando gravação obsoleta de outro dispositivo: passou.
- Mensagem recebida por Supabase Realtime, histórico após nova sessão, chat de clube, bloqueio de intrusão e bloqueio de usuário: passaram.
- Perfil privado e imagens protegidas, solicitação não autoaprovável, PDF inválido recusado e convite privado aceito somente pelo destinatário: passaram.
- Broadcast privado de digitação entregue ao participante e negado à conta externa: passou.
- Exportação de dados e exclusão real das contas de QA pelo endpoint autenticado: passaram.
- Limpeza final confirmou zero usuários de QA, zero livros, zero mensagens e zero objetos de Storage. A biblioteca inicia vazia.
- Auditoria SQL confirmou RLS em todas as 28 tabelas públicas.
- Verificações SQL em transação com rollback: cartão mínimo de perfil privado, nome de cadastro e aprovação autorizada com trilha de moderação passaram.
- Auditoria npm de dependências de produção: zero vulnerabilidades reportadas na execução.
- Navegador: home desktop, prévia em iframe de 390 px, PDF real de três páginas, paginação, rolagem, texto adaptável, busca em três páginas e seleção real de texto foram observados.
- Corrigido conflito do CSS completo do visualizador PDF com a barra lateral; a aplicação mantém a navegação correta após fechar o leitor.
- Android: build Gradle debug executado localmente com sucesso. A assinatura e os metadados do APK são verificados no pacote final.

**Compilação não equivale a instalação ou teste em aparelho.** Não houve celular ou emulador Android disponível para verificar navegação nativa, TTS, retomada de sessão e áudio em segundo plano.

## Problemas corrigidos durante a implementação

1. Referência ambígua a `book_id` no conflito de progresso: alterada para a constraint nominal e revalidada com gravação obsoleta.
2. Criação de clube privado com `INSERT RETURNING` bloqueada pela fotografia transacional do helper estável: a política agora confere diretamente o proprietário da linha nova.
3. CSS global do visualizador PDF alterava a navegação da aplicação: substituído pela camada de texto isolada por seletor.
4. Fotos inicialmente públicas: bucket e políticas ajustados para respeitar a privacidade do perfil, com URLs temporárias no cliente.
5. Identidade de anexos: o backend exige pasta do remetente e da conversa correspondente.
6. Privacidade do cache de interface: troca de identidade limpa consultas em memória e respostas atrasadas de perfil são descartadas.

## Integrações e bloqueios externos

| Item | Estado |
| --- | --- |
| Supabase LIVRIA | Criado, ativo, migrações aplicadas, duas Edge Functions ativas |
| Projeto RPG anterior | Preservado; não recebeu migrações nem alterações |
| GitHub MegaDev13 | Conectado para consultar/trabalhar em repositórios existentes |
| Repositório LIVRIA | Fonte isolada em `MegaDev13/asdas`, pasta `livria/`, branch `livria/desenvolvimento`, conforme autorização posterior |
| Push e execução dos workflows | Concluídos: Web e Android passaram; evidências em `GITHUB-ACTIONS.json` |
| GitHub Pages público | Prévia publicada com aprovação em 10/11/2026: https://megadev13.github.io/asdas/livria/; 11 testes e build aprovados no run `42860422485`, tentativa 2 |
| APK | Compilado no GitHub Actions, assinatura e artefatos baixados verificados; continua como debug de avaliação |
| Assinatura de produção | Pipeline preparado; faltam chave estável e Secrets do proprietário |
| E-mail de confirmação/recuperação | Código preparado; falta URL final de Auth e teste real de entrega/retorno |
| Proteção contra senhas vazadas | Uma consulta intermediária sinalizou a configuração; a auditoria final retornou lista vazia. Conferir no painel antes de produção |

## Pendências funcionais do escopo completo

As seguintes funções ainda não estão prontas ou não foram validadas de ponta a ponta:

- Upload com retomada de transferência; edição completa de metadados depois da validação; automação de limpeza de órfãos; audiobooks com checagem estrutural adicional no servidor.
- Coleções temáticas, listas personalizadas, múltiplos autores normalizados, popularidade/nota no catálogo, recomendações por interesses e curadoria de destaques.
- OCR, miniaturas do leitor, ajuste explícito à altura, brilho nativo e reancoragem de destaque em rotação alternativa. A seleção para destacar é por página; marcações não são exibidas em páginas giradas até voltar à orientação original.
- Sincronização palavra a palavra sobre o PDF, posição de TTS dentro de um segmento, pausa nativa que retome exatamente a frase, serviço Android de áudio em segundo plano e integração completa dos controles de mídia.
- Reações/comentários próprios de resenhas, respostas encadeadas no feed, salvar publicações, compartilhamento social de notas e gerenciamento visual completo de listas públicas.
- Busca no histórico de mensagens, compartilhamento rico de livro/citação, controles granulares e interface de confirmação de leitura, atualização imediata da lista global de não lidas em todas as telas e fila offline completa de mensagens/anexos.
- Enquetes, cronograma por etapas/capítulos, metas coletivas agregadas, convites com expiração e funções administrativas intermediárias do clube. Nesta versão, convites e remoção são controlados pelo proprietário; ninguém consegue se promover pelo cliente.
- Conquistas, insígnias, desafios, retrospectiva, mapas de atividade, distribuição de gêneros, horários, comparações históricas e metas personalizadas além das metas diária e anual.
- Notificações push e todos os eventos sociais adicionais do prompt.
- Download gerenciado para reabrir PDFs offline no aplicativo, cache privado completo após reinício e resolução interativa de conflitos de alterações offline. A fila atual cobre novas anotações; exclusões e edições offline completas continuam pendentes.
- Gestão administrativa ampla de usuários/categorias/clubes, telemetria e painéis técnicos de capacidade.
- Testes de interface autenticados completos, teste físico Android, links de e-mail/deep links no aplicativo, teste em diferentes navegadores e auditoria independente antes de produção.

O nome e o nome de usuário aparecem no diretório para permitir solicitações de acompanhamento; o restante do perfil privado é protegido. PDFs protegidos não são publicados em bucket irrestrito. Capas permanecem públicas, conforme documentado na operação.

## Próxima etapa concreta

Configurar Auth com a URL pública verificada, resolver os testes de e-mail e testar o APK em um aparelho. Concluir os recursos pendentes antes de aprovar produção. O pacote atual pode ser instalado como versão de avaliação, sem depender de um servidor particular continuamente ligado.
