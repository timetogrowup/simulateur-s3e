S3E — LOT T1 : COLLECTEUR CLOUDFLARE / D1 (NON DÉPLOYÉ)
Version : 19/10/2026
Source : docs/evolutions/EVOL-COM-001_lot_T1_collecteur_cloudflare.txt

Le site public GitHub Pages n'émet toujours AUCUNE télémétrie. Le Worker
et les migrations sont préparés en code, sans compte Cloudflare connecté.

Fichiers
  src/worker.js : API d'événements et d'agrégats + purge des IDs après 48h
  migrations/0001_init.sql : tables D1
  wrangler.toml : exemple à compléter avec le vrai database_id.
  ../tests/cloudflare-worker.test.mjs : tests via mocks locaux Node 22

Pour tester sans compte Cloudflare :
  npm run test:telemetry

Pour déployer ULTÉRIEUREMENT, après choix des contrôles anti-abus et
information RGPD :
1. Créer un compte Cloudflare puis une base D1 nommée s3e-audience ;
   relever l'identifiant réel de la base.
2. Renseigner la liaison [[d1_databases]] dans wrangler.toml ;
   ne jamais committer de token secret.
3. Appliquer migrations D1 avec l'outil Wrangler authentifié.
4. Définir REPORT_API_TOKEN comme secret Cloudflare :
   npx wrangler secret put REPORT_API_TOKEN
5. Vérifier ALLOWED_ORIGIN=https://timetogrowup.github.io
6. Tester /v1/events et /v1/summary sans trafic humain réel.
7. Faire approuver protection contre abus, absence de tracking
   personnel, tests API réels et mentions d'information.
8. Ensuite seulement envisager T2 : instrumentation de first()
   dans index.html, avec un drapeau d'activation et exclusion CI.

Exemple (non à exécuter sans compte et validation) :
  npx wrangler d1 migrations apply s3e-audience --remote
  npx wrangler deploy

Contrats :
  POST /v1/events : simulation_completed, UUID d'opération,
    réponse 202 nouveau / 200 doublon ; aucune réponse financière.
  GET /v1/summary?date=YYYY-MM-DD&tz=Europe%2FParis
    Authorization: Bearer <secret> ; compteurs horaires agrégés.
  Cron Worker : 02:17 UTC, purge des clés de dédoublonnage >48h.
  Les compteurs permanents ne sont pas encore purgés : durée
    proposée 90 jours, à valider avant mise en production.

LIMITES ET RISQUES :
CORS n'authentifie pas les visiteurs et ne suffit pas comme
contrôle anti-robot ; validation anti-abus nécessaire avant T2.
Ces tests sont des simulations de D1, pas une validation en
environnement Cloudflare réel ni une validation RGPD.
Le nombre de personnes physiques distinctes n'est pas mesurable
avec ce modèle, volontairement sans identifiant visiteur.
