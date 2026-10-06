# claude-mod-compact-token-weather

Mod Claude Code privé, basé sur `context-bar` de [hamzafer/claude-code-mods](https://github.com/hamzafer/claude-code-mods) (licence MIT, voir `LICENSE`).

Plugin : `compact-token-bar`. Commande : `/compact-token-bar` (affiche ou masque la barre).

## Changements par rapport à `context-bar`

- Échelle de couleurs neutre (un dégradé ardoise, du foncé au clair) au lieu de l'arc-en-ciel.
- Sur le desktop, la carte tient sur une ligne, dessinée en SVG : « Context », puis la barre dans toute la place libre, puis le remplissage mesuré contre le seuil de compactage (« 371k of 967k  38% »), puis les limites, puis le chevron. Petit texte gris, vraies rayures diagonales par catégorie, petits points gris en quinconce, sur un fond à peine plus clair, pour `messages`, trait fin pour l'espace libre, hachures pour le tampon. La légende s'ouvre dessous avec les mêmes motifs. Au survol, une infobulle par segment et une pour les limites. Dans un terminal, repli en caractères.
- Pas de contour ; titre « Context » un peu plus grand que les chiffres, en gris léger. Textes en anglais (`Context`, `compacts at`, `limit`).
- Légende détaillée repliée par défaut. Le chevron (un trait, pointe vers le bas fermé, vers le haut ouvert) l'ouvre ou la ferme. La croix `✕` en haut à droite masque la carte ; `/compact-token-bar` la réaffiche.
- Limites d'abonnement dans l'en-tête, après un séparateur `│ limite` : `5h` limite de session et `week` limite hebdomadaire, écrits en toutes lettres, en pourcentage. Gris tant que tout va bien, orange dès 70 %, rouge dès 90 %. Même règle pour le pourcentage de contexte. Le survol donne l'info complète, avec le temps avant la remise à zéro. Rien ne s'affiche hors abonnement.

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
