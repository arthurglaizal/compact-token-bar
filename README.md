# claude-mod-compact-token-weather

Mod Claude Code privé, basé sur `context-bar` de [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods) (licence MIT, voir `LICENSE`).

Plugin : `compact-token-bar`. Commande : `/compact-token-bar` (affiche ou masque la barre).

## Changements par rapport à `context-bar`

- Échelle de couleurs neutre (un dégradé ardoise, du foncé au clair) au lieu de l'arc-en-ciel.
- Sur le desktop, la barre est un SVG : vraies rayures diagonales par catégorie, points pour `messages`, trait fin pour l'espace libre, hachures pour le tampon de compactage, et une infobulle native au survol de chaque segment. Dans un terminal, repli en caractères (`▆` pleins, `⠿` pour `messages`, `▃` pour le tampon).
- Titre et contour en gris léger. Textes en anglais (`Context`, `compacts at`, `limit`).
- Légende détaillée repliée par défaut. Le chevron en bout de frise l'ouvre (`▾`) ou la ferme (`▴`). La croix `×` en haut à droite masque la carte ; `/compact-token-bar` la réaffiche.
- Limites d'abonnement dans l'en-tête, après un séparateur `│ limite` : `◷` (horloge) limite de session (5 h) et `▦` (calendrier) limite hebdomadaire, en glyphes texte de la couleur du texte, en pourcentage. Gris tant que tout va bien, orange dès 70 %, rouge dès 90 %. Même règle pour le pourcentage de contexte. Le survol donne l'info complète, avec le temps avant la remise à zéro. Rien ne s'affiche hors abonnement.

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
