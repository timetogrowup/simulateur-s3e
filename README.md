# Simulateur S3E — test mobile

Prototype public destiné uniquement à la recette fonctionnelle. Les données AEN et compensations ainsi que les hypothèses fiscales et sociales sont **fictives et non validées**.

## Démarrage

Ouvrir `index.html` via GitHub Pages après activation dans Settings > Pages (Deploy from a branch > main > /root).

## Parcours

Questionnaire conditionnel de 23 questions (la question sur la recharge gratuite hors domicile a été retirée), trois scénarios, premier bilan, affinage des montants, nouveau bilan, sauvegarde locale, export CSV et impression.

## Limites de cette publication

Cette page est une **adaptation autonome pour premiers essais sur téléphone**, distincte du projet modulaire S3E v0.1. Elle ne remplace pas la recette des modules ni la validation réglementaire des calculs. Elle ne contient aucun référentiel interne SUEZ.

Les données sont conservées localement dans le navigateur si l'utilisateur choisit de sauvegarder. Aucune donnée personnelle n'est envoyée à un serveur applicatif.

## Évolution AEN-001 (prototype de recette)

Le montant brut de l'avantage en nature n'est **pas** une dépense directe du salarié. Le moteur ventile l'effet annuel estimé en cotisations salariales supplémentaires et impôt supplémentaire, en tenant compte d'une hypothèse paramétrable de déductibilité de certaines cotisations.

**Les taux, la déductibilité, les traitements des compensations et les montants AEN sont fictifs/approximatifs et ne doivent pas être utilisés pour prendre une décision financière avant vérification paie et fiscalité.** L'hypothèse de 70 % de cotisations déductibles est purement technique pour démontrer le paramétrage, pas une règle validée.

## Mise à jour et contrôle

Les tests automatiques sont disponibles dans `tests/smoke.cjs`, exécutés via GitHub Actions à chaque mise à jour. Les barèmes et le catalogue officiels SUEZ ne sont pas inclus. Le code est encore un prototype monofichier et doit être progressivement modularisé selon l'architecture du projet.
