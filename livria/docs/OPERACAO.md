# Operação, configuração e distribuição

## Supabase existente nesta entrega

Projeto: **LIVRIA**, referência `qtxrftukwtgvsetgztic`, região São Paulo (`sa-east-1`). Foi criado separado do projeto RPG. O esquema foi aplicado no projeto real; as duas Edge Functions estão ativas. Não há dados de demonstração inseridos como conteúdo de produção.

URL de API: `https://qtxrftukwtgvsetgztic.supabase.co`.

O arquivo `.env.example` contém exclusivamente credenciais públicas do cliente. O projeto usa Auth para contas, PostgreSQL com RLS, Storage para arquivos e Realtime para mensagens e notificações. Funções privilegiadas ficam no esquema não exposto `private`; as operações públicas checam identidade e autorização.

## Reproduzir em outro Supabase

Instale as dependências com `npm ci`. A CLI está fixada em v2.101.0 para evitar mudanças da CLI v3. Confira `npx supabase --help` antes de usá-la em outro ambiente. Em um projeto novo, aplique todos os arquivos de `supabase/migrations` na ordem de seus nomes. Não rode migrações iniciais novamente em um projeto já configurado.

As migrações criam tabelas, políticas, buckets, limites, índices, publicação Realtime e funções RPC. Aplique cada arquivo inteiro. Em caso de falha, verifique o retorno antes de continuar; os arquivos maiores usam transações.

Depois de autenticar a CLI na sua própria máquina e associar o projeto correto, publique:

```bash
npx supabase functions deploy finalize-upload --project-ref SEU_PROJECT_REF --no-verify-jwt
npx supabase functions deploy account-data --project-ref SEU_PROJECT_REF --no-verify-jwt
```

O `verify_jwt=false` dessas funções não significa acesso anônimo: ambas exigem `Authorization: Bearer ...` e consultam `auth.getUser(token)` no corpo antes de qualquer operação. Isso mantém compatibilidade com os tokens do Auth sem depender da verificação legada do gateway. Não remova essa checagem.

## Auth e e-mail

Em Authentication → URL Configuration, defina o site real e os URLs de redirecionamento permitidos. Para desenvolvimento, use `http://localhost:5173`. Para GitHub Pages, inclua a origem e o caminho reais do repositório. Configure o retorno de recuperação para a rota `#/nova-senha` e confirme o fluxo com um e-mail sob seu controle.

A prévia pública está disponível em `https://megadev13.github.io/asdas/livria/`. O Site URL e os redirecionamentos do Auth ainda precisam ser configurados e testados com esse endereço. Nenhum SMTP próprio foi configurado; verifique também as restrições do envio padrão antes de abrir cadastros para outras pessoas. O cadastro depende de confirmação por e-mail conforme a configuração do Auth. Login por senha foi validado com contas temporárias confirmadas; não foi verificada a entrega de e-mails. A integração de retorno de links de e-mail diretamente para o aplicativo Android ainda está pendente. Depois de confirmar o e-mail, o usuário pode voltar ao aplicativo e entrar por senha.

Uma consulta intermediária do auditor Supabase indicou **Leaked Password Protection Disabled**; a consulta final retornou lista vazia. Confirme a configuração no painel Auth antes de produção e ative a proteção quando disponível no plano utilizado. Não houve contratação de plano pago. Consulte a [documentação de segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Storage

| Bucket | Acesso | Limite por arquivo |
| --- | --- | --- |
| `book-files` | Privado, livro validado e usuário autorizado | 20 MB |
| `book-covers` | Público, formatos de imagem restritos | 5 MB |
| `profile-images` | Leitura conforme privacidade do perfil | 5 MB |
| `message-attachments` | Participantes da conversa | 5 MB |
| `audiobook-files` | Usuários autorizados a ler a obra | 50 MB por capítulo |

O fluxo de PDF cria um rascunho, envia o arquivo e chama `finalize-upload`. O servidor verifica assinatura, estrutura, páginas e SHA-256. PDFs privados válidos são aprovados para o proprietário; compartilhamentos comunitários entram em revisão. Um PDF inválido permanece como rascunho e não gera URL assinada de leitura.

Uploads que falharam antes da criação dos metadados e arquivos de capa antigos podem exigir limpeza de órfãos. Não remova objetos em massa sem comparar as referências no banco. A exclusão de conta percorre as pastas do usuário antes de remover a identidade e os dados associados.

## Moderação

O administrador deve primeiro criar e confirmar a própria conta. Um operador confiável do projeto concede acesso pelo SQL Editor usando o UUID correto dessa conta:

```sql
insert into private.admins(user_id) values ('UUID_DO_ADMIN_CONFIRMADO');
```

Não use campos editáveis de perfil ou `user_metadata` para conceder acesso. A tela de configurações mostra a entrada de moderação somente após `my_admin_status()`. Aprovação, rejeição e ocultação são conferidas no backend e registradas em `moderation_actions`.

## GitHub

O proprietário autorizou uma branch em repositório existente. A LIVRIA usa `MegaDev13/asdas`, branch `livria/desenvolvimento`, com a fonte na pasta `livria/`. O arquivo anterior `amor.html` e a branch `main` permanecem preservados. A primeira publicação foi autorizada pelo proprietário em 10/11/2026. A origem do Pages foi alterada para GitHub Actions, mantendo o conteúdo de `amor.html` no artefato publicado.

Os workflows ativos são os arquivos `livria-*.yml` da raiz do repositório. Os workflows dentro de `livria/.github/workflows` são exemplos para uma futura extração do projeto.

Depois do push, `LIVRIA - Web e qualidade` executa os testes e o build. `LIVRIA - APK Android` compila com Node 24, Java 21, SDK 36 e Gradle Wrapper versionado. O APK aparece em Artifacts → `LIVRIA-Android-<número>`. Os artefatos ficam disponíveis por 30 dias.

As variáveis públicas opcionais do repositório são `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; sem elas, o código usa o projeto desta entrega.

Para uma versão assinada de produção, configure GitHub Secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_STORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

O exemplo de workflow de release, dentro de `livria/.github/workflows`, permite compilar a variante release com esses segredos em um repositório dedicado. O workflow ativo da branch produz somente debug e não lê segredos de assinatura. A chave de assinatura deve ser criada e guardada pelo proprietário. Não foi incluída chave privada no código. APKs debug de máquinas distintas podem ter assinaturas distintas; use uma assinatura estável antes de oferecer atualizações que preservem a instalação anterior.

## Pages e aprovação de publicação

A prévia foi publicada com aprovação do proprietário em 10/11/2026 e verificada no navegador: [LIVRIA](https://megadev13.github.io/asdas/livria/). A página anterior continua acessível em [amor.html](https://megadev13.github.io/asdas/amor.html). O conteúdo de `amor.html` e a branch `main` permanecem inalterados.

O workflow ativo `.github/workflows/livria-pages.yml` publica a partir da branch `livria/publicacao`, executa 11 testes e compila a aplicação antes de reunir a LIVRIA em `/livria/` e `amor.html` na raiz. Settings → Pages → Source está definido como GitHub Actions. O ambiente `github-pages` permite especificamente `main` e `livria/publicacao`, sem curingas e sem segredos de ambiente.

A primeira tentativa foi recusada pela regra antiga que permitia somente `main`. Após adicionar a branch de publicação e ajustar a origem do Pages, a tentativa 2 do [run 42860422485](https://github.com/MegaDev13/asdas/actions/runs/42860422485) concluiu com sucesso no commit `3c7f6ba245685cf2ac581da56ed36bc7cb91faeb`. O endereço foi obtido do resultado real do workflow e conferido em sessão pública.

O exemplo standalone `Publish GitHub Pages (approved)`, dentro de `livria/.github/workflows`, continua destinado à extração futura do projeto. Não mude a visibilidade do repositório ou publique conteúdo de outras áreas sem autorização.

## Releases e manifesto de atualizações

O app consulta `app_versions`. Somente um operador de backend pode cadastrar versões. Após publicar um APK assinado em um local HTTPS verificado, cadastre versão, código crescente, notas e link. A tela oferece o download com escolha do usuário, sem instalação silenciosa.

Livros, perfis, mensagens e clubes são buscados do Supabase e não exigem novo APK. Código, novos plugins nativos e mudanças de permissões exigem recompilar. Um workflow opcional de release está incluído; mantenha lançamentos como rascunho até revisão.

## Backup e recuperação

Antes de migrações relevantes, exporte o banco e as políticas pelo fluxo de backup do Supabase disponível no plano. Faça backup separado dos objetos do Storage: o dump SQL não inclui os bytes dos arquivos. Preserve também migrações, fonte e chave de assinatura fora do APK.

Para recuperar, use um projeto separado, restaure esquema e dados, replique os objetos mantendo seus caminhos e valide Auth/RLS antes de trocar a configuração do cliente. Nunca teste recuperação sobrescrevendo diretamente o ambiente existente.

## Testes

`npm test` executa os testes unitários. `tests/live.mjs` e `tests/extended.mjs` usam três contas descartáveis reais em um projeto de QA; não estão habilitados no CI público por padrão. O arquivo de credenciais é fornecido por `LIVRIA_QA_FILE` e precisa permanecer fora do Git.

Os testes reais enviam arquivos e mensagens, verificam RLS e podem excluir as contas e seus conteúdos. O relatório preserva somente nomes, resultados e horários, sem senhas ou tokens. A confirmação de instalação e os testes nativos em Android exigem aparelho ou emulador e continuam pendentes.

## Execuções verificadas

- Web: https://github.com/MegaDev13/asdas/actions/runs/42841261827 — sucesso.
- Android: https://github.com/MegaDev13/asdas/actions/runs/42841261449 — sucesso.
- Fonte testada: `6e8a681f2240082c1b502015027b150b2a0c9723`.
- APK obtido do artefato `LIVRIA-Android-2`, assinatura v2 verificada e SHA-256 registrado em `GITHUB-ACTIONS.json`.

A compilação Android foi corrigida para `setup-android@v4`, sem o pacote descontinuado `tools`. O código do app continua na versão 0.1.0.
