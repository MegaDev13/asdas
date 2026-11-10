# LIVRIA

O projeto LIVRIA está isolado na pasta [`livria/`](livria/) desta branch `livria/desenvolvimento`.

```bash
cd livria
npm ci
npm run dev
```

Os workflows `.github/workflows/livria-ci.yml` e `livria-android.yml` verificam a aplicação e geram os artefatos Web e APK nos pushes desta branch. Os dois workflows já passaram no GitHub Actions. As execuções e o checksum do APK estão em [`livria/docs/GITHUB-ACTIONS.json`](livria/docs/GITHUB-ACTIONS.json). A primeira publicação pública do site permanece sujeita à aprovação do proprietário; o workflow `livria-pages.yml` está preparado para a futura branch `livria/publicacao`, preservando a página atual.

Documentação: [visão geral](livria/README.md), [estado da implementação](livria/docs/STATUS.md) e [operação](livria/docs/OPERACAO.md).

Os arquivos anteriores do repositório são preservados. Não é necessário alterar a branch principal para desenvolver e compilar a LIVRIA.
