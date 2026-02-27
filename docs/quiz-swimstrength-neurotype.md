# Quiz SwimStrength — Découvre ton Type d'Entraînement de Nageur

> **Source** : [Athlete Type Scorecard – SwimStrength](https://jake-avwtmngr.scoreapp.com/)
> **Plateforme** : ScoreApp (Inertia.js / React)
> **Nombre de questions** : 30 (choix multiples, set fixe)

---

## Concept & Logique du Quiz

Ce quiz identifie le **Neurotype d'entraînement** du nageur parmi 5 profils, basés sur les neurotransmetteurs dominants. Chaque réponse attribue des points à une ou plusieurs catégories. Le score final est exprimé en pourcentage par catégorie, puis classé en 3 niveaux. Le neurotype dominant (pourcentage le plus élevé) détermine le profil affiché.

### Les 5 Neurotypes

| Code | Nom | Neurotransmetteur dominant |
|------|-----|---------------------------|
| **1A** | Neurotype Intensité | Dopamine |
| **1B** | Neurotype Explosif | Dopamine + Adrénaline |
| **2A** | Neurotype Variation | Adrénaline + Sérotonine |
| **2B** | Neurotype Sensation | Sérotonine + GABA |
| **Type 3** | Neurotype Contrôle | GABA |

### Les 3 Niveaux de Résultat

| Niveau | Plage | Signification |
|--------|-------|---------------|
| **Inadapté** *(Unsuited)* | 0 – 48 % | Ce neurotype ne te correspond pas |
| **Potentiel** *(Potential)* | 49 – 70 % | Correspondance partielle |
| **Correspondance** *(Match)* | 71 – 100 % | Forte correspondance |

### Logique de Scoring

- Chaque question propose 2 ou 3 réponses.
- Chaque réponse est rattachée à une ou plusieurs catégories de neurotype (ou à aucune).
- Score final = (points obtenus ÷ points possibles) × 100, calculé par catégorie.
- Le neurotype avec le pourcentage le plus élevé = résultat principal.

---

## Les 30 Questions du Quiz (avec scoring complet)

> **Légende** : après chaque option, les catégories entre parenthèses indiquent les neurotypes qui reçoivent des points. *(vide)* = aucune catégorie scorée.

### Q1 — Es-tu toujours en quête de nouvelles expériences et avide d'apprendre ?
- a) Oui, en permanence → *(1B, 2A)*
- b) Pas de façon obsessionnelle → *(2B, Type 3)*
- c) Ça dépend des périodes → *(2A)*

### Q2 — Dirais-tu que tu es plutôt calme au quotidien, mais avec des coups de sang qui retombent vite ?
- a) Oui, je peux m'emporter mais ça retombe vite → *(1B, 2A)*
- b) Non, quand je m'énerve ça dure → *(2B, Type 3)*
- c) Ça dépend des moments → *(2A)*

### Q3 — Qu'est-ce qui te motive le plus : atteindre des objectifs précis (records, médailles) ou voir des progrès petit à petit ?
- a) Les objectifs précis → *(1A, 1B, 2A)*
- b) Les progrès graduels → *(Type 3)*
- c) Un mélange des deux → *(2A)*

### Q4 — Tu donnes le meilleur de toi quand les enjeux sont élevés (finales, grandes compétitions) ou quand la pression est faible ?
- a) Quand les enjeux sont élevés → *(1A, 1B)*
- b) Quand la pression est faible → *(2B, Type 3)*
- c) Entre les deux → *(2A)*

### Q5 — Les règles et l'autorité, c'est ton truc ou pas du tout ?
- a) Pas du tout, j'aime les bousculer → *(1A, 1B)*
- b) Oui, je les respecte → *(2B, Type 3)*
- c) Ça dépend des situations → *(2A)*

### Q6 — Préfères-tu t'entraîner longtemps à intensité modérée, ou court mais à fond ?
- a) Court mais à fond → *(1A, 1B)*
- b) Longtemps à intensité modérée → *(Type 3)*
- c) Un peu des deux → *(2A)*

### Q7 — Est-ce que tu fais souvent passer les autres avant toi — quitte à le regretter ensuite ?
- a) Oui, souvent → *(2B)*
- b) Parfois → *(1B, 2A, 2B)*
- c) Pas vraiment → *(1A)*

### Q8 — Es-tu capable de bien te concentrer sur une tâche tout en sachant passer rapidement d'une chose à l'autre ?
- a) Oui → *(1B, 2A)*
- b) Un peu → *(2A)*
- c) Pas vraiment → *(1A, 2B, Type 3)*

### Q9 — Est-ce que tu te retrouves souvent dans le rôle du « leader silencieux » — celui qui montre l'exemple sans avoir besoin de donner des ordres ?
- a) Oui → *(1B, 2A)*
- b) Un peu → *(2A)*
- c) Pas vraiment → *(vide)*

### Q10 — Es-tu très impatient(e) et toujours en train de vouloir faire quelque chose en attendant ?
- a) Oui → *(1B, 2A)*
- b) Un peu → *(2A)*
- c) Pas vraiment → *(Type 3)*

### Q11 — Es-tu particulièrement motivé(e) par le fait de gagner le respect et l'admiration des autres ?
- a) Oui → *(1B, 2A, 2B)*
- b) Un peu → *(2A, 2B)*
- c) Pas vraiment → *(1A, 1B, Type 3)*

### Q12 — As-tu tendance à adopter le comportement de la personne en face de toi, à faire ce qu'il faut pour être apprécié(e) ?
- a) Oui → *(1B, 2A)*
- b) Un peu → *(1B, 2A)*
- c) Pas vraiment → *(vide)*

### Q13 — Quand quelqu'un te raconte quelque chose, tu adores rebondir avec « Ah non, moi aussi ça m'est arrivé ! » — tu cherches toujours à créer un lien ?
- a) Oui → *(1B, 2A, 2B)*
- b) Un peu → *(2A, 2B)*
- c) Pas vraiment → *(vide)*

### Q14 — Est-ce que tu procrastines souvent et fais ton meilleur travail à la dernière minute ?
- a) Oui, tout le temps → *(1B, 2A, 2B)*
- b) Parfois → *(2A)*
- c) Jamais → *(Type 3)*

### Q15 — L'opinion des autres compte beaucoup pour toi ?
- a) Oui → *(2A, 2B)*
- b) Un peu → *(1B, 2A, 2B)*
- c) Pas du tout → *(1A, 1B)*

### Q16 — Tu as besoin de varier et de changer régulièrement pour rester motivé(e) à l'entraînement ?
- a) Oui, c'est indispensable → *(1B, 2A, 2B)*
- b) Un peu → *(1B, 2A)*
- c) Non, je préfère la régularité → *(1A, 2B, Type 3)*

### Q17 — Tu es ami(e) avec tout le monde, ou plutôt du genre à avoir un petit cercle d'amis très proches ?
- a) J'ai beaucoup d'amis → *(2A)*
- b) Peu d'amis, mais très proches → *(1A, 2B, Type 3)*
- c) Un mélange des deux → *(1B, 2A)*

### Q18 — Tu as besoin de te donner à fond et de « sentir la brûlure » pour que tes séances te motivent ?
- a) Oui, j'adore sentir que ça brûle → *(2B)*
- b) Non, je suis motivé(e) par autre chose → *(1A, 2B, Type 3)*

### Q19 — Tu aimes bien t'habiller et soigner ton apparence ?
- a) Oui → *(2A, 2B)*
- b) Parfois → *(1B, 2A)*
- c) Pas spécialement → *(1A, 2B, Type 3)*

### Q20 — Tu as du mal à te laisser aller et à baisser ta garde ?
- a) Oui → *(Type 3)*
- b) Un peu → *(2B, Type 3)*
- c) Pas vraiment → *(1B, 2A)*

### Q21 — Tu aimes tout planifier à l'avance pour éviter les imprévus ?
- a) Oui → *(2B, Type 3)*
- b) Parfois → *(vide)*
- c) Non, je suis plutôt spontané(e) → *(1B, 2A)*

### Q22 — Tu as besoin de te sentir calme et en contrôle pour donner le meilleur de toi-même ?
- a) Oui → *(2B, Type 3)*
- b) Non → *(1B, 2A)*

### Q23 — Qu'est-ce qui te pousse le plus : gagner, ou impressionner les autres et gagner leur respect ?
- a) Gagner → *(1A, 1B, 2A, 2B)*
- b) Impressionner et gagner le respect → *(1A, 1B, 2A, 2B)*
- c) Un mélange des deux → *(1B, 2A)*

### Q24 — Tes amis diraient que tu es du genre à toujours vouloir avoir raison dans une discussion animée ?
- a) Oui, c'est tout moi → *(1A, 2A, 2B)*
- b) Pas vraiment → *(1A, 1B, 2A, 2B)*

### Q25 — Tu fais du trash-talk avant les courses ?
- a) Oui, carrément → *(1A, 2A, 2B)*
- b) Parfois, pour rigoler → *(1B, 2A)*
- c) Pas vraiment → *(1A, 1B, 2A, 2B, Type 3)*

### Q26 — Tu préfères des échauffements courts ou longs ?
- a) Courts → *(1A, 1B, 2A, 2B, Type 3)*
- b) Longs → *(1A, 1B, 2A, 2B, Type 3)*

### Q27 — Tu nages mieux en fin de série difficile, ou tu es capable d'envoyer fort dès le départ ?
- a) Fort dès le départ → *(1A, 1B, 2A, 2B, Type 3)*
- b) Je monte en puissance et je suis meilleur vers la fin → *(1A, 1B, 2A, 2B, Type 3)*

### Q28 — Tu préfères beaucoup de variété dans tes entraînements, ou quelque chose de plus prévisible ?
- a) J'ai besoin de changement pour rester motivé(e) → *(1A, 1B, 2A, 2B, Type 3)*
- b) Je n'aime pas trop que ça change → *(1A, 1B, 2B, Type 3)*

### Q29 — Tu t'ennuies vite quand tu enchaînes les mêmes distances, les mêmes nages, les mêmes allures ?
- a) Oui, j'ai besoin de varier → *(1A, 1B, 2A, 2B, Type 3)*
- b) Non, j'aime la répétition → *(1A, 1B, 2B, Type 3)*

### Q30 — Tu aimes être le leader du groupe ou le centre de l'attention ?
- a) Oui → *(1A, 2B, Type 3)*
- b) Ça ne me dérange pas → *(1A, 1B)*

---

## Les 5 Profils de Résultat

---

### 1A — Le Neurotype INTENSITÉ

**Neurotransmetteur dominant** : Dopamine
**Devise** : « Tu dois devenir plus fort pour devenir plus rapide. »

#### Traits de personnalité

- Bruyant, confiant, compétitif — adore être le leader
- Impatient ; s'épanouit face aux défis orientés vers un objectif
- Agit par impulsion et aime prendre des risques
- Adore gagner — mauvais perdant *et* mauvais gagnant
- Peut être très intense mais s'épuise vite
- Déteste les règles, sauf quand c'est lui qui les enfreint
- Très charismatique — excellent motivateur sur de courtes périodes

#### Entraînement en Salle

- Travail explosif lourd, travail de puissance depuis l'arrêt, isométriques haute intensité, développement de la force brute (exercices composés, peu de répétitions, haute intensité)
- Force maximale : travailler à 85 %+ du max en 3-5 répétitions par série
- Temps de repos longs (2-5 min) pour maintenir l'intensité
- Faible volume mais effort maximal pour se sentir au mieux et progresser le plus vite
- Doit viser des records personnels chaque semaine en changeant les exercices principaux régulièrement

#### Entraînement en Piscine

- Sprints courts à fond (5-10 s) avec beaucoup de récupération (2-10 min)
- A besoin de progrès chiffrés et suivis pour rester motivé
- S'épanouit avec le travail de sprint résisté (parachutes, plaquettes, palmes, élastiques)
- Se démotive avec les longues séries aérobiques
- Le conditioning doit être basé sur de la haute intensité avec des repos courts — pas trop de volume, sinon il perd son tranchant, son intensité et sa motivation

---

### 1B — Le Neurotype EXPLOSIF

**Neurotransmetteur dominant** : Dopamine + Adrénaline
**Devise** : « Tu dois devenir plus puissant pour devenir plus rapide et plus fort. »

#### Traits de personnalité

- Très compétitif mais garde ses émotions plus sous contrôle que le 1A
- Apprend de nouvelles compétences rapidement et s'adapte vite
- Performe mieux sous pression et aime les défis
- S'ennuie facilement et a besoin de variété
- Adore les tâches explosives et à forte intensité
- D'un naturel plutôt calme, mais capable de montées explosives ponctuelles avant de retrouver son calme rapidement

#### Entraînement en Salle

- Travail explosif haute intensité : sauts, haltérophilie olympique, mouvements réactifs
- Profite du travail en superset/contraste (ex. : squat lourd + saut en contre-haut)
- La variété est essentielle — rotation fréquente des exercices
- Faible volume mais puissance maximale : 1-5 répétitions à 85 %+ du max
- Peut aussi profiter d'un travail de force de base pour poser les fondations

#### Entraînement en Piscine

- Sprints courts (5-10 s) avec récupération complète (2-10 min)
- A besoin de variété dans le travail de nage (différents stimuli : technique, vitesse, résistance)
- Peut intégrer du travail résisté mais plutôt léger
- Faible tolérance au travail lactique
- Le meilleur moyen de développer son endurance aérobie : intervalles haute intensité ou travail à intensité modérée en changeant régulièrement le focus

---

### 2A — Le Neurotype VARIATION

**Neurotransmetteur dominant** : Adrénaline + Sérotonine
**Devise** : « Tout fonctionne, mais rien ne fonctionne longtemps. »

#### Traits de personnalité

- Adaptable — peut s'épanouir dans la plupart des conditions d'entraînement
- Facilement influencé par l'environnement et le style de coaching
- A besoin de changements fréquents pour rester engagé
- Peut encaisser un volume élevé mais risque le burn-out mental
- Papillon social — ami avec tout le monde, s'adapte à tous les groupes
- Motivé par le cadre social de l'entraînement
- Extraverti, énergique et communicatif

#### Entraînement en Salle

- Rotation entre différents schémas de répétitions
- Alternance de blocs d'entraînement (phases de 3-4 semaines)
- Entraînement hybride : mélange de force, d'explosivité et de volume
- S'ennuie vite avec un programme trop figé
- Répond bien à un cadre structuré mais avec de la variété intégrée

#### Entraînement en Piscine

- Capable de gérer aussi bien la haute intensité que l'endurance, mais a besoin de changer régulièrement
- Mélanger les focus au sein des séances (technique, vitesse, allure, résistance)
- S'épanouit avec un mix de travail résisté, de vitesse et d'allure de course
- Profite de l'ambiance de groupe et du cadre social
- Se démotive si les séances sont trop répétitives

---

### 2B — Le Neurotype SENSATION

**Neurotransmetteur dominant** : Sérotonine + GABA
**Devise** : « Guidé par les émotions, il s'épanouit quand il se sent fort et connecté. »

#### Traits de personnalité

- Guidé par ses émotions et très intuitif
- Travaille plus dur quand il se sent respecté et valorisé
- Peut avoir tendance à en faire trop s'il pense que cela lui vaudra de la reconnaissance
- Peut être en difficulté dans les situations de forte pression
- Empathique — ressent intensément les émotions des autres
- Fait souvent passer les autres avant lui-même (et le regrette parfois)
- Motivé par le sens personnel plutôt que par la compétition pure

#### Entraînement en Salle

- La connexion corps-esprit *(mind-muscle connection)* est primordiale
- Pour la force : répétitions modérées (6-10) avec des tempos lents
- Préfère une programmation structurée et prévisible
- Aime la sensation d'effort, de « pump » et de brûlure musculaire
- A besoin d'une surcharge progressive régulière et méthodique

#### Entraînement en Piscine

- Monte en puissance progressivement au fil de la séance — meilleur vers la fin
- Aime travailler dur et « sentir » qu'il a bien bossé
- Peut encaisser du travail d'endurance mais a besoin de soutien émotionnel
- Le travail de vitesse doit être sur des distances plus longues (25-50 m) avec moins de repos
- A besoin d'encouragements et d'un cadre bienveillant pour donner le meilleur de lui-même

---

### Type 3 — Le Neurotype CONTRÔLE

**Neurotransmetteur dominant** : GABA
**Devise** : « S'épanouit dans la structure, la précision et la constance. »

#### Traits de personnalité

- Très analytique et soucieux du détail
- A tendance à trop réfléchir et supporte mal l'imprévu
- Préfère la planification à long terme et la structure
- N'aime pas prendre de risques — préfère une progression constante et contrôlée
- A du mal à baisser sa garde et à faire confiance aux autres
- A besoin de se sentir calme et en contrôle pour performer
- Introverti, réservé, fidèle à la routine

#### Entraînement en Salle

- Blocs d'entraînement constants (mêmes exercices, même structure pendant plusieurs semaines/mois)
- Surcharge progressive graduelle et méthodique
- Préfère le travail isométrique et le tempo lent
- A besoin de tout connaître à l'avance (exercices, séries, repos)
- Se sent déstabilisé par les changements non prévus dans le programme

#### Entraînement en Piscine

- A besoin d'échauffements longs et progressifs
- Préfère des séries constantes avec un minimum de variation
- Peut encaisser un volume élevé d'endurance
- Le travail de vitesse doit rester minimal et prévisible
- Performe mieux quand il connaît la séance à l'avance et peut s'y préparer mentalement

---

## Offre Post-Quiz

**« Tu as débloqué 3 semaines GRATUITES sur le Programme Elite ! »**

- Sans engagement — Annule à tout moment
- 3 séances par semaine conçues pour ton type d'entraînement (nouvelle phase toutes les 3 semaines)
- Développe force, mobilité et explosivité plus vite que tout autre programme

---

*Quiz créé par SwimStrength, propulsé par ScoreApp.*
