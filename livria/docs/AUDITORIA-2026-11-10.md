# Auditoria da LIVRIA - 10/11/2026

Versão corrigida: **0.1.1**, código Android 2. Base examinada: `0c49aa24cea319b9feeecca4a62ce3f7a0404677`.

## Conclusão

A LIVRIA continua sendo uma versão de avaliação, com núcleo funcional e lacunas relevantes do prompt mestre. A aprovação dos testes locais não comprova entrega de e-mail, execução em Android ou todos os fluxos autenticados. Esta auditoria corrigiu falhas de catálogo, progresso, retorno de autenticação e atualização do chat, e preparou três obras em português com direitos documentados.

O escopo foi comparado com **Texto colado(7).txt**, o prompt mestre de 30 seções lido integralmente. A matriz abaixo registra o estado do produto; itens de documentação e execução não são tratados como funcionalidades do aplicativo.

## Bugs e correções

| ID | Prioridade | Evidência na versão anterior | Correção / verificação atual |
| --- | --- | --- | --- |
| A01 | Alta | `saveProgress` retornava imediatamente se outra gravação estivesse em andamento. Uma mudança de página podia ficar sem gravação. | Fila serial mantém a posição mais recente; teste com requisição lenta confirma páginas 2 e 7 e encadeamento de versões do servidor. |
| A02 | Alta | O sucesso de uma gravação removia o rascunho local, mesmo quando havia mudanças posteriores. | Rascunho só é removido quando não existe posição pendente; testes cobrem falha de rede, repetição e conflito entre dispositivos. |
| A03 | Alta | A recuperação usava `#/nova-senha` no retorno, concorrendo com o fragmento de tokens do fluxo implicit do Supabase. | Retorno usa `?auth=recovery`; evento `PASSWORD_RECOVERY` e sessão recuperada abrem a rota correta. Teste verifica caminho aninhado. Entrega e clique reais no e-mail continuam pendentes. |
| A04 | Média | A consulta da estante pessoal ignorava busca e ordenação, carregando todos os IDs sem paginação. | Busca, ordenação estável, filtros e paginação de 24 resultados são aplicados ao catálogo e à estante com relacionamento protegido por RLS. Cinco testes reais foram preparados e estão bloqueados, não classificados como aprovados. |
| A05 | Média | Cada atualização Realtime substituía todo o histórico do chat pelas 40 mensagens mais recentes, descartando páginas antigas já carregadas. | Mesclagem por ID preserva histórico e aplica edições; teste cobre sobreposição, ordem e ausência de duplicatas. Exclusão remove a linha local. Revalidação autenticada em Realtime está pendente. |
| A06 | Média | Contadores de mensagens não lidas e lista de conversas não eram invalidados depois de receber/ler mensagens. | Invalidação das consultas na leitura e nos eventos de mensagens, com limpeza da inscrição ao sair. Verificado por revisão de código; teste integrado pendente. |
| A07 | Média | Extração assíncrona de texto de uma página antiga podia sobrescrever a página atual. | Resultados atrasados são descartados após mudança de página/documento. Fluxos locais de paginação e modo adaptável foram observados no navegador. |
| A08 | Média | Troca de documento mantinha trabalho pendente de busca/narração e nem sempre liberava o PDF anterior. | Cancelamento por sequência e destruição do documento na saída; página restaurada limitada ao número de páginas do novo PDF. |
| A09 | Baixa | Ausência de resultados com gênero/idioma era apresentada como biblioteca recém-aberta. | Mensagem específica para filtros sem resultado, observada na interface. |
| A10 | Funcional | Faltavam filtros de idioma/domínio público e categorias adequadas às novas obras. | Filtros e categorias Economia, Política e Sociologia disponíveis no catálogo e no envio; interface verificada. |
| A11 | Baixa | O workflow Android fixava `0.1.0` no nome do APK, mesmo quando o manifesto já continha outra versão. | Nome derivado de `package.json`. O APK compilado foi inspecionado: `com.livria.app`, versão `0.1.1`, código 2; pacote de entrega renomeado e checksum conferido. |

As mudanças preservam o controle de concorrência no backend: conflito com outro dispositivo mantém o rascunho e pede reabertura, sem substituir automaticamente o progresso mais recente do servidor.

## Verificações executadas nesta auditoria

- Testes locais: **16 aprovados**. Cinco testes de integração do novo catálogo foram preparados e ignorados sem as credenciais descartáveis; não contam como aprovação.
- TypeScript, compilação Vite e geração/verificação sintática do service worker: passaram.
- GitHub Actions Web, Android e Pages passaram no commit `015dee8aa207b67915505d5c92942cc35e65ad61`. O site público mostra 0.1.1; `amor.html` continua acessível.
- APK: manifesto binário conferido (`com.livria.app`, 0.1.1, código 2), assinatura v2 verificada no pipeline, ZIP íntegro e SHA-256 conferido. Links e hashes em `AUDITORIA-RESULTADOS.json`.
- `npm audit --omit=dev`: **zero vulnerabilidades reportadas** nesta execução. Isso não equivale a uma auditoria independente de segurança.
- Banco: nenhuma tabela pública sem RLS; nenhuma função `SECURITY DEFINER` no esquema público. As operações privilegiadas permanecem no esquema privado ou em Edge Functions autenticadas.
- Auditor Supabase: um aviso de segurança atual, proteção contra senhas vazadas desativada. Performance indicou apenas índices ainda não utilizados; eles foram preservados, pois o acervo está começando.
- Navegador: filtros de idioma/licença, busca vazia, abertura de PDF real com 31 páginas, navegação até a página 4, texto adaptável, rolagem progressiva e busca de `capitalista` com 18 páginas encontradas.
- PDFs preparados: **1.495 blocos de origem** preservados e conferidos por extração de texto; fontes e licença integral presentes. Páginas de amostra dos três arquivos foram renderizadas e inspecionadas.

Os relatórios antigos de 18 + 6 cenários integrados correspondem à avaliação 0.1.0, e não foram reexecutados nesta rodada. Não há evidência nova de instalação física em Android, narração nativa ou entrega de mensagens autenticadas após estas correções.

## Pendências prioritárias e limitações

1. Configurar e testar o Site URL, os retornos de confirmação/recuperação e a entrega real de e-mail no Supabase. Os novos retornos são `https://megadev13.github.io/asdas/livria/?auth=confirm` e `https://megadev13.github.io/asdas/livria/?auth=recovery`.
2. Conferir a disponibilidade e ativar [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) no plano utilizado, sem contratação automática.
3. Reexecutar os testes autenticados e os cinco cenários do catálogo após autorização específica para credenciais descartáveis. As contas reais existentes foram preservadas.
4. Testar o APK em aparelho/emulador: leitura, rotação, interrupções, sessão e TTS. A assinatura atual continua sendo debug; falta chave estável de produção.
5. Áudio gravado: erros de salvamento de posição ainda não têm tratamento completo; renovação de URL temporária durante capítulos extensos deve ser testada. Pausa nativa de TTS ainda reinicia a página.
6. Offline: a fila cobre novas anotações. Download privado de livros para reabertura após reinício, edição/exclusão offline e fila completa de mensagens continuam incompletos.
7. Documentos complexos: sem OCR, miniaturas, ajuste explícito à altura e ancoragem de destaques em rotação alternativa. A seleção de texto e os destaques atuais são por página.
8. Social/clubes: faltam recursos de listas, resenhas com reações/comentários próprios, enquetes, metas coletivas por etapa, funções intermediárias de moderação e notificações adicionais.
9. Métricas: faltam calendário completo, distribuição de gêneros, comparações históricas, metas personalizadas e gamificação. Páginas visitadas e tempo ativo continuam sendo estimativas, não prova de leitura integral.

## Conferência do prompt mestre

| Seção | Estado / evidência e lacuna principal |
| --- | --- |
| 1-2 Missão e conceito | Núcleo integrado disponível; produto completo ainda pendente. |
| 3 Arquitetura | React/TS/Vite/Capacitor/Supabase/GitHub Pages reais; distribuição de produção assinada pendente. |
| 4 Contas | Login, sessão, exportação e exclusão implementados; e-mail e retorno Android pendentes de validação real. |
| 5 Perfis | Nome, foto, capa, bio, cores, privacidade e seguidores presentes; disposição, emblemas e estatísticas públicas selecionáveis incompletos. |
| 6 Biblioteca | Upload/validação/moderação/estante reais; busca pessoal corrigida. Metadados completos, listas personalizadas, popularidade, curadoria e upload retomável incompletos. |
| 7 Leitor | Paginação, rolagem, texto, busca e anotações presentes; cancelamento assíncrono e progresso corrigidos. OCR, miniaturas e ferramentas avançadas pendentes. |
| 8 Áudio | TTS Web/nativo e áudio por capítulos presentes; reprodução em segundo plano, retomada por frase e controles nativos completos pendentes. |
| 9 Métricas | Sessões ativas, sequência e metas básicas; indicadores avançados e conquistas incompletos. |
| 10 Rede social | Feed, resenhas, comentários e privacidade básicos; recomendações e compartilhamento rico incompletos. |
| 11 Chat | Histórico, anexos e Realtime presentes; mesclagem e atualização de contadores corrigidas. Busca, confirmações granulares e fila offline incompletas. |
| 12 Clubes | Clubes, convites, membros, chat e tópicos presentes; enquetes, etapas, papéis intermediários e metas coletivas incompletos. |
| 13 Notificações | Central interna e alguns eventos presentes; push e todos os demais eventos pendentes. |
| 14 UX | Design responsivo e temas presentes; validação de acessibilidade e de todos os estados autenticados ainda parcial. |
| 15-16 Banco/Storage | Migrações, integridade, RLS e buckets privados presentes; revisões independentes e operações de limpeza de órfãos pendentes. |
| 17 Offline | Interface/preferências e novas anotações; fluxo completo de livro/mensagens offline pendente. |
| 18 Segurança | Autorizações e operações privilegiadas protegidas; aviso de senha vazada e validação operacional de Auth pendentes. |
| 19 Android | Pipeline real de compilação e artefatos; assinatura estável e teste físico pendentes. |
| 20 Pages | Publicação real em `/livria/`, com `amor.html` preservado. |
| 21 Testes | 16 testes locais atuais; 5 cenários novos ignorados. Testes integrados históricos documentados; nova execução autenticada bloqueada. |
| 22 Desempenho | Divisão de código, paginação e PDF progressivo presentes; monitoramento de capacidade e testes de carga pendentes. |
| 23 Administração | Revisão de livros/denúncias e trilha presentes; painel amplo de usuários/categorias/clubes incompleto. |
| 24 Extras | Alguns recursos presentes; extras não são classificados como entrega completa. |
| 25-27 Execução/documentação | Fonte, workflows, arquitetura, operação, status e esta auditoria versionados; dependências externas explicitadas. |
| 28-30 Aceitação/resultado | Critérios centrais parcialmente comprovados. A plataforma não está aprovada como produto completo de produção. |

## Obras pesquisadas e preparadas

| Obra | Autor / falecimento | Origem | PDF / situação |
| --- | --- | --- | --- |
| A dissolução do regimen capitalista (1897) | Teixeira Bastos / 1902 | [Gutenberg 24701](https://www.gutenberg.org/ebooks/24701) | 31 páginas; pronto, ainda não importado. |
| O Primeiro de Maio (1894) | Sebastião de Magalhães Lima / 1928 | [Gutenberg 32379](https://www.gutenberg.org/ebooks/32379) | 106 páginas; pronto, ainda não importado. |
| O crédito agrícola em Portugal (1899) | Jaime de Magalhães Lima / 1936 | [Gutenberg 24412](https://www.gutenberg.org/ebooks/24412) | 21 páginas; pronto, ainda não importado. |

São textos originais em português, com ortografia histórica, sem tradução moderna. O enquadramento de domínio público no Brasil foi feito pelo prazo do [art. 41 da Lei 9.610/1998](https://www2.camara.leg.br/legin/fed/lei/1998/lei-9610-19-fevereiro-1998-365399-normaatualizada-pl.html), combinado com as datas dos autores nas fontes. A licença e os créditos da transcrição foram preservados integralmente. Os PDFs são composições digitais para leitura, não fac-símiles nem contagens das páginas impressas.

**O Capital não foi incluído.** A [edição portuguesa consultada no MIA](https://www.marxists.org/portugues/marx/1867/capital/index.htm) declara direitos de tradução reservados a Edições Progresso-Editorial Avante!, 1990. A autorização de transcrição daquele site não comprova autorização para republicação pela LIVRIA. A versão do Wikisource consultada ainda estava em tradução e tampouco seria um livro integral em domínio público. Não foi usado PDF comercial encontrado na internet como prova de liberdade de uso.

Os hashes SHA-256, páginas, metadados e fontes estão em `CATALOGO-DOMINIO-PUBLICO.json`. A composição pode ser reproduzida com `scripts/build-curated-pdfs.py`; nenhum PDF foi colocado no GitHub como banco de livros.

## Bloqueio operacional

A revisão automática recusou a transmissão de três identidades de QA com senhas aleatórias e uma chave temporária para o endpoint de importação/testes do Supabase da LIVRIA, exigindo autorização específica desse envio. A checagem local confirmou que eram credenciais recém-geradas, em domínio `.invalid`, e não credenciais do usuário, mas a revisão manteve a recusa.

Não foram criadas contas de QA ou de curadoria e nenhum livro foi importado. A função temporária foi substituída por uma resposta inativa, com verificação JWT habilitada; uma chamada sem autenticação retornou 401. Não há acesso administrativo novo ativo no cliente nem segredos no repositório. Os três PDFs e os testes estão prontos para continuação após autorização. Não se deve tentar contornar essa recusa com outra via de transmissão.
