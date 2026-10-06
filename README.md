# claude-mod-compact-token-weather

Mod Claude Code privé, basé sur `context-bar` de [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods) (licence MIT, voir `LICENSE`).

Plugin : `compact-claude-token`. Commande : `/compact-token` (affiche ou masque la barre).

## Changements par rapport à `context-bar`

- Palette neutre (gris) au lieu de l'arc-en-ciel. Seul `messages` garde l'orange.
- Chaque catégorie a sa propre texture (`▓ ▚ ▤ ▥ ▦ ▞ ▒`), donc la barre se lit sans les couleurs.
- Survol d'un segment : son nom, ses tokens et son pourcentage s'affichent.
- Légende détaillée repliée par défaut. La flèche `▸` en bout de ligne du titre l'ouvre ou la ferme.

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
