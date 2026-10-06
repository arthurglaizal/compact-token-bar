# claude-mod-compact-token-weather

Mod Claude Code privé, basé sur `context-bar` de [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods) (licence MIT, voir `LICENSE`).

Plugin : `compact-token-bar`. Commande : `/compact-token-bar` (affiche ou masque la barre).

## Changements par rapport à `context-bar`

- Échelle de couleurs neutre (un dégradé ardoise, du foncé au clair) au lieu de l'arc-en-ciel. Seul `messages` garde l'orange, comme mise en avant.
- Chaque catégorie a sa propre texture (`▓ ▚ ▤ ▥ ▦ ▞ ▒`), donc la barre se lit sans les couleurs.
- Survol d'un segment : son nom, ses tokens et son pourcentage s'affichent.
- Légende détaillée repliée par défaut. La flèche `▸` en bout de ligne du titre l'ouvre ou la ferme.
- Limites d'abonnement dans l'en-tête, après un séparateur `│` : `◷` limite de session (5 h) et `▦` limite hebdomadaire, en pourcentage. Jaune dès 70 %, rouge dès 90 %. Le survol donne l'heure de remise à zéro. Rien ne s'affiche hors abonnement.

## Tester

```sh
claude --plugin-dir /chemin/vers/ce/dossier
```

Prérequis : Claude Code 2.1.287 ou plus récent.

Attention : si `context-bar` est aussi installé, les deux affichent une barre. Désactive l'un des deux pendant les tests.

## Vérifier

```sh
claude plugin validate .
claude plugin test .
```
