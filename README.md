# Simulateur S3E — test mobile

Prototype public destiné uniquement à la recette fonctionnelle. Les données AEN et compensations ainsi que les hypothèses fiscales et sociales sont **fictives et non validées**.

## Démarrage

Ouvrir `index.html` via GitHub Pages après activation dans Settings > Pages (Deploy from a branch > main > /root).

## Parcours

Questionnaire conditionnel de 25 questions (la question sur la recharge gratuite hors domicile a été retirée), trois scénarios, premier bilan, affinage des montants, nouveau bilan, sauvegarde locale, export CSV et impression.

## Limites de cette publication

Cette page est une **adaptation autonome pour premiers essais sur téléphone**, distincte du projet modulaire S3E v0.1. Elle ne remplace pas la recette des modules ni la validation réglementaire des calculs. Elle ne contient aucun référentiel interne SUEZ.

Les données sont conservées localement dans le navigateur si l'utilisateur choisit de sauvegarder. Aucune donnée personnelle n'est envoyée à un serveur applicatif.

## Évolution AEN-001 (prototype de recette)

Le montant brut de l'avantage en nature n'est **pas** une dépense directe du salarié. Le moteur ventile l'effet annuel estimé en cotisations salariales supplémentaires et impôt supplémentaire, en tenant compte d'une hypothèse paramétrable de déductibilité de certaines cotisations.

**Les taux, la déductibilité, les traitements des compensations et les montants AEN sont fictifs/approximatifs et ne doivent pas être utilisés pour prendre une décision financière avant vérification paie et fiscalité.** L'hypothèse de 70 % de cotisations déductibles est purement technique pour démontrer le paramétrage, pas une règle validée.

## Mise à jour et contrôle

Les tests automatiques sont disponibles dans `tests/smoke.cjs`, exécutés via GitHub Actions à chaque mise à jour. Les barèmes et le catalogue officiels SUEZ ne sont pas inclus. Le code est encore un prototype monofichier et doit être progressivement modularisé selon l'architecture du projet.

## Référentiels séparés — version de recette

Les fichiers sous `referentiels/` sont des jeux de données **entièrement fictifs** :

- `aen_TEST.js` : montants mensuels d'AEN proposés dans les deux questions correspondantes.
- `compensations_TEST.js` : montants mensuels de compensation en cas de restitution du véhicule de fonction.
- `vehicules_TEST.js` : consommations indicatives par motorisation, sans désigner un catalogue SUEZ réel.
- `hypotheses_TEST.js` : tarifs de l'énergie, entretien, assurance, revente et paramètres fiscaux provisoires.

Les fichiers sont chargés localement par le navigateur depuis GitHub Pages **avant** le moteur JavaScript, sans API ni collecte des réponses. Les propriétés `statut: "FICTIF"` sont vérifiées au démarrage. Les montants AEN et compensations sont extraits des fichiers, et ne sont plus répétés dans les formules.

**Attention :** modifier des fichiers de tests ne suffit pas à rendre des données officielles. Avant intégration réelle, vérifier les schémas, la provenance, les dates d'application, les règles d'éligibilité et la fiscalité. La validation actuelle interdit volontairement de faire passer un fichier marqué autrement que FICTIF pour un jeu de test.

## Gouvernance ChatGPT + GitHub

Le document de référence est [docs/gouvernance_projet_chatgpt_github.txt](docs/gouvernance_projet_chatgpt_github.txt). Il décrit les responsabilités, les décisions, la gestion des versions, le cycle d'évolution, les contrôles, les niveaux de validation et les règles de confidentialité. Ce document est une proposition de gouvernance soumise à l'adoption du responsable du projet.

## Recharge publique payante — EVOL-RECHARGE-002

Lorsque la recharge du futur véhicule électrique SUEZ à domicile est impossible, la simulation considère les bornes publiques payantes comme étant à la charge du salarié et demande leur tarif. Si le domicile est accessible, le questionnaire distingue la recharge à domicile et les recharges extérieures payées personnellement. Seules les charges extérieures effectivement couvertes par SUEZ sont sans coût pour le salarié. Les prix sont fictifs. Voir [la décision métier détaillée](docs/evolutions/EVOL-RECHARGE-002_recharge_publique_payante.txt).

### Si la recharge à domicile est impossible

Le questionnaire rapide ne demande **pas** le tarif de recharge publique. Il applique automatiquement le tarif fictif `kwhPublic` du référentiel `referentiels/hypotheses_TEST.js` (0,50 €/kWh actuellement), sur 100 % des recharges payantes à l'extérieur. Le salarié peut modifier ce prix lors de l'**affinage du bilan**. Aucun tarif SUEZ officiel n'est revendiqué.

## Contrôles GitHub Actions — EVOL-CI-001

Le workflow [S3E - Contrôles qualité](.github/workflows/s3e-tests.yml) s'exécute à chaque push sur `main` et sur les pull requests. Il lance `node tests/smoke.cjs`, `node tests/validate-referentiels.cjs` et `node tests/validate-docs.cjs`. Le validateur documentaire contrôle les TXT obligatoires ; avec l'historique Git disponible, toute modification d'index.html ou des référentiels exige une mise à jour conjointe d'un TXT sous `docs/`. [Cadrage TXT](docs/evolutions/EVOL-CI-001_github_actions.txt).

Ces tests n'évaluent pas encore un navigateur réel et **ne bloquent pas automatiquement la publication GitHub Pages**. Ils ne remplacent pas la recette métier ou fiscale.
