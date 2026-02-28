// Neurotype Quiz Data — 30 questions + 5 profiles
// Source: SwimStrength Athlete Type Scorecard

import type { NeurotypCode } from "./api/types";

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: number;
  text: string;
  options: Array<{
    label: string;
    scores: NeurotypCode[];
    weight: number; // points given to each listed category
  }>;
}

export const NEUROTYPE_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: "Es-tu toujours en quête de nouvelles expériences et avide d'apprendre ?",
    options: [
      { label: "Oui, en permanence", scores: ["1B", "2A"], weight: 36 },
      { label: "Pas de façon obsessionnelle", scores: ["2B", "3"], weight: 30 },
      { label: "Ça dépend des périodes", scores: ["2A"], weight: 36 },
    ],
  },
  {
    id: 2,
    text: "Dirais-tu que tu es plutôt calme au quotidien, mais avec des coups de sang qui retombent vite ?",
    options: [
      { label: "Oui, je peux m'emporter mais ça retombe vite", scores: ["1B", "2A"], weight: 36 },
      { label: "Non, quand je m'énerve ça dure", scores: ["2B", "3"], weight: 30 },
      { label: "Ça dépend des moments", scores: ["2A"], weight: 36 },
    ],
  },
  {
    id: 3,
    text: "Qu'est-ce qui te motive le plus : atteindre des objectifs précis (records, médailles) ou voir des progrès petit à petit ?",
    options: [
      { label: "Les objectifs précis", scores: ["1A", "1B", "2A"], weight: 52 },
      { label: "Les progrès graduels", scores: ["3"], weight: 28 },
      { label: "Un mélange des deux", scores: ["2A"], weight: 37 },
    ],
  },
  {
    id: 4,
    text: "Tu donnes le meilleur de toi quand les enjeux sont élevés (finales, grandes compétitions) ou quand la pression est faible ?",
    options: [
      { label: "Quand les enjeux sont élevés", scores: ["1A", "1B"], weight: 28 },
      { label: "Quand la pression est faible", scores: ["2B", "3"], weight: 30 },
      { label: "Entre les deux", scores: ["2A"], weight: 26 },
    ],
  },
  {
    id: 5,
    text: "Les règles et l'autorité, c'est ton truc ou pas du tout ?",
    options: [
      { label: "Pas du tout, j'aime les bousculer", scores: ["1A", "1B"], weight: 28 },
      { label: "Oui, je les respecte", scores: ["2B", "3"], weight: 30 },
      { label: "Ça dépend des situations", scores: ["2A"], weight: 26 },
    ],
  },
  {
    id: 6,
    text: "Préfères-tu t'entraîner longtemps à intensité modérée, ou court mais à fond ?",
    options: [
      { label: "Court mais à fond", scores: ["1A", "1B"], weight: 28 },
      { label: "Longtemps à intensité modérée", scores: ["3"], weight: 28 },
      { label: "Un peu des deux", scores: ["2A"], weight: 26 },
    ],
  },
  {
    id: 7,
    text: "Est-ce que tu fais souvent passer les autres avant toi — quitte à le regretter ensuite ?",
    options: [
      { label: "Oui, souvent", scores: ["2B"], weight: 0 },
      { label: "Parfois", scores: ["1B", "2A", "2B"], weight: 15 },
      { label: "Pas vraiment", scores: ["1A"], weight: 0 },
    ],
  },
  {
    id: 8,
    text: "Es-tu capable de bien te concentrer sur une tâche tout en sachant passer rapidement d'une chose à l'autre ?",
    options: [
      { label: "Oui", scores: ["1B", "2A"], weight: 38 },
      { label: "Un peu", scores: ["2A"], weight: 37 },
      { label: "Pas vraiment", scores: ["1A", "2B", "3"], weight: 35 },
    ],
  },
  {
    id: 9,
    text: "Est-ce que tu te retrouves souvent dans le rôle du « leader silencieux » — celui qui montre l'exemple sans avoir besoin de donner des ordres ?",
    options: [
      { label: "Oui", scores: ["1B", "2A"], weight: 38 },
      { label: "Un peu", scores: ["2A"], weight: 37 },
      { label: "Pas vraiment", scores: [], weight: 0 },
    ],
  },
  {
    id: 10,
    text: "Es-tu très impatient(e) et toujours en train de vouloir faire quelque chose en attendant ?",
    options: [
      { label: "Oui", scores: ["1B", "2A"], weight: 38 },
      { label: "Un peu", scores: ["2A"], weight: 37 },
      { label: "Pas vraiment", scores: ["3"], weight: 57 },
    ],
  },
  {
    id: 11,
    text: "Es-tu particulièrement motivé(e) par le fait de gagner le respect et l'admiration des autres ?",
    options: [
      { label: "Oui", scores: ["1B", "2A", "2B"], weight: 0 },
      { label: "Un peu", scores: ["2A", "2B"], weight: 31 },
      { label: "Pas vraiment", scores: ["1A", "1B", "3"], weight: 0 },
    ],
  },
  {
    id: 12,
    text: "As-tu tendance à adopter le comportement de la personne en face de toi, à faire ce qu'il faut pour être apprécié(e) ?",
    options: [
      { label: "Oui", scores: ["1B", "2A"], weight: 36 },
      { label: "Un peu", scores: ["1B", "2A"], weight: 12 },
      { label: "Pas vraiment", scores: [], weight: 0 },
    ],
  },
  {
    id: 13,
    text: "Quand quelqu'un te raconte quelque chose, tu adores rebondir avec « Ah non, moi aussi ça m'est arrivé ! » — tu cherches toujours à créer un lien ?",
    options: [
      { label: "Oui", scores: ["1B", "2A", "2B"], weight: 0 },
      { label: "Un peu", scores: ["2A", "2B"], weight: 31 },
      { label: "Pas vraiment", scores: [], weight: 0 },
    ],
  },
  {
    id: 14,
    text: "Est-ce que tu procrastines souvent et fais ton meilleur travail à la dernière minute ?",
    options: [
      { label: "Oui, tout le temps", scores: ["1B", "2A", "2B"], weight: 13 },
      { label: "Parfois", scores: ["2A"], weight: 29 },
      { label: "Jamais", scores: ["3"], weight: 57 },
    ],
  },
  {
    id: 15,
    text: "L'opinion des autres compte beaucoup pour toi ?",
    options: [
      { label: "Oui", scores: ["2A", "2B"], weight: 20 },
      { label: "Un peu", scores: ["1B", "2A", "2B"], weight: 0 },
      { label: "Pas du tout", scores: ["1A", "1B"], weight: 0 },
    ],
  },
  {
    id: 16,
    text: "Tu as besoin de varier et de changer régulièrement pour rester motivé(e) à l'entraînement ?",
    options: [
      { label: "Oui, c'est indispensable", scores: ["1B", "2A", "2B"], weight: 0 },
      { label: "Un peu", scores: ["1B", "2A"], weight: 16 },
      { label: "Non, je préfère la régularité", scores: ["1A", "2B", "3"], weight: 35 },
    ],
  },
  {
    id: 17,
    text: "Tu es ami(e) avec tout le monde, ou plutôt du genre à avoir un petit cercle d'amis très proches ?",
    options: [
      { label: "J'ai beaucoup d'amis", scores: ["2A"], weight: 52 },
      { label: "Peu d'amis, mais très proches", scores: ["1A", "2B", "3"], weight: 35 },
      { label: "Un mélange des deux", scores: ["1B", "2A"], weight: 36 },
    ],
  },
  {
    id: 18,
    text: "Tu as besoin de te donner à fond et de « sentir la brûlure » pour que tes séances te motivent ?",
    options: [
      { label: "Oui, j'adore sentir que ça brûle", scores: ["2B"], weight: 0 },
      { label: "Non, je suis motivé(e) par autre chose", scores: ["1A", "2B", "3"], weight: 35 },
    ],
  },
  {
    id: 19,
    text: "Tu aimes bien t'habiller et soigner ton apparence ?",
    options: [
      { label: "Oui", scores: ["2A", "2B"], weight: 26 },
      { label: "Parfois", scores: ["1B", "2A"], weight: 21 },
      { label: "Pas spécialement", scores: ["1A", "2B", "3"], weight: 0 },
    ],
  },
  {
    id: 20,
    text: "Tu as du mal à te laisser aller et à baisser ta garde ?",
    options: [
      { label: "Oui", scores: ["3"], weight: 78 },
      { label: "Un peu", scores: ["2B", "3"], weight: 4 },
      { label: "Pas vraiment", scores: ["1B", "2A"], weight: 25 },
    ],
  },
  {
    id: 21,
    text: "Tu aimes tout planifier à l'avance pour éviter les imprévus ?",
    options: [
      { label: "Oui", scores: ["2B", "3"], weight: 46 },
      { label: "Parfois", scores: [], weight: 0 },
      { label: "Non, je suis plutôt spontané(e)", scores: ["1B", "2A"], weight: 25 },
    ],
  },
  {
    id: 22,
    text: "Tu as besoin de te sentir calme et en contrôle pour donner le meilleur de toi-même ?",
    options: [
      { label: "Oui", scores: ["2B", "3"], weight: 0 },
      { label: "Non", scores: ["1B", "2A"], weight: 25 },
    ],
  },
  {
    id: 23,
    text: "Qu'est-ce qui te pousse le plus : gagner, ou impressionner les autres et gagner leur respect ?",
    options: [
      { label: "Gagner", scores: ["1A", "1B", "2A", "2B"], weight: 17 },
      { label: "Impressionner et gagner le respect", scores: ["1A", "1B", "2A", "2B"], weight: 6 },
      { label: "Un mélange des deux", scores: ["1B", "2A"], weight: 25 },
    ],
  },
  {
    id: 24,
    text: "Tes amis diraient que tu es du genre à toujours vouloir avoir raison dans une discussion animée ?",
    options: [
      { label: "Oui, c'est tout moi", scores: ["1A", "2A", "2B"], weight: 43 },
      { label: "Pas vraiment", scores: ["1A", "1B", "2A", "2B"], weight: 4 },
    ],
  },
  {
    id: 25,
    text: "Tu fais du trash-talk avant les courses ?",
    options: [
      { label: "Oui, carrément", scores: ["1A", "2A", "2B"], weight: 38 },
      { label: "Parfois, pour rigoler", scores: ["1B", "2A"], weight: 26 },
      { label: "Pas vraiment", scores: ["1A", "1B", "2A", "2B", "3"], weight: 20 },
    ],
  },
  {
    id: 26,
    text: "Tu préfères des échauffements courts ou longs ?",
    options: [
      { label: "Courts", scores: ["1A", "1B", "2A", "2B", "3"], weight: 24 },
      { label: "Longs", scores: ["1A", "1B", "2A", "2B", "3"], weight: 0 },
    ],
  },
  {
    id: 27,
    text: "Tu nages mieux en fin de série difficile, ou tu es capable d'envoyer fort dès le départ ?",
    options: [
      { label: "Fort dès le départ", scores: ["1A", "1B", "2A", "2B", "3"], weight: 24 },
      { label: "Je monte en puissance et je suis meilleur vers la fin", scores: ["1A", "1B", "2A", "2B", "3"], weight: 0 },
    ],
  },
  {
    id: 28,
    text: "Tu préfères beaucoup de variété dans tes entraînements, ou quelque chose de plus prévisible ?",
    options: [
      { label: "J'ai besoin de changement pour rester motivé(e)", scores: ["1A", "1B", "2A", "2B", "3"], weight: 24 },
      { label: "Je n'aime pas trop que ça change", scores: ["1A", "1B", "2B", "3"], weight: 0 },
    ],
  },
  {
    id: 29,
    text: "Tu t'ennuies vite quand tu enchaînes les mêmes distances, les mêmes nages, les mêmes allures ?",
    options: [
      { label: "Oui, j'ai besoin de varier", scores: ["1A", "1B", "2A", "2B", "3"], weight: 24 },
      { label: "Non, j'aime la répétition", scores: ["1A", "1B", "2B", "3"], weight: 0 },
    ],
  },
  {
    id: 30,
    text: "Tu aimes être le leader du groupe ou le centre de l'attention ?",
    options: [
      { label: "Oui", scores: ["1A", "2B", "3"], weight: 32 },
      { label: "Ça ne me dérange pas", scores: ["1A", "1B"], weight: 0 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export interface NeurotypProfile {
  code: NeurotypCode;
  name: string;
  fullName: string;
  neurotransmitter: string;
  motto: string;
  traits: string[];
  gymTraining: string[];
  poolTraining: string[];
}

export const NEUROTYPE_PROFILES: Record<NeurotypCode, NeurotypProfile> = {
  "1A": {
    code: "1A",
    name: "Intensité",
    fullName: "Le Neurotype INTENSITÉ",
    neurotransmitter: "Dopamine",
    motto: "Tu dois devenir plus fort pour devenir plus rapide.",
    traits: [
      "Bruyant, confiant, compétitif — adore être le leader",
      "Impatient ; s'épanouit face aux défis orientés vers un objectif",
      "Agit par impulsion et aime prendre des risques",
      "Adore gagner — mauvais perdant et mauvais gagnant",
      "Peut être très intense mais s'épuise vite",
      "Déteste les règles, sauf quand c'est lui qui les enfreint",
      "Très charismatique — excellent motivateur sur de courtes périodes",
    ],
    gymTraining: [
      "Travail explosif lourd, travail de puissance depuis l'arrêt, isométriques haute intensité, développement de la force brute (exercices composés, peu de répétitions, haute intensité)",
      "Force maximale : travailler à 85 %+ du max en 3-5 répétitions par série",
      "Temps de repos longs (2-5 min) pour maintenir l'intensité",
      "Faible volume mais effort maximal pour se sentir au mieux et progresser le plus vite",
      "Doit viser des records personnels chaque semaine en changeant les exercices principaux régulièrement",
    ],
    poolTraining: [
      "Sprints courts à fond (5-10 s) avec beaucoup de récupération (2-10 min)",
      "A besoin de progrès chiffrés et suivis pour rester motivé",
      "S'épanouit avec le travail de sprint résisté (parachutes, plaquettes, palmes, élastiques)",
      "Se démotive avec les longues séries aérobiques",
      "Le conditioning doit être basé sur de la haute intensité avec des repos courts — pas trop de volume, sinon il perd son tranchant, son intensité et sa motivation",
    ],
  },
  "1B": {
    code: "1B",
    name: "Explosif",
    fullName: "Le Neurotype EXPLOSIF",
    neurotransmitter: "Dopamine + Adrénaline",
    motto: "Tu dois devenir plus puissant pour devenir plus rapide et plus fort.",
    traits: [
      "Très compétitif mais garde ses émotions plus sous contrôle que le 1A",
      "Apprend de nouvelles compétences rapidement et s'adapte vite",
      "Performe mieux sous pression et aime les défis",
      "S'ennuie facilement et a besoin de variété",
      "Adore les tâches explosives et à forte intensité",
      "D'un naturel plutôt calme, mais capable de montées explosives ponctuelles avant de retrouver son calme rapidement",
    ],
    gymTraining: [
      "Travail explosif haute intensité : sauts, haltérophilie olympique, mouvements réactifs",
      "Profite du travail en superset/contraste (ex. : squat lourd + saut en contre-haut)",
      "La variété est essentielle — rotation fréquente des exercices",
      "Faible volume mais puissance maximale : 1-5 répétitions à 85 %+ du max",
      "Peut aussi profiter d'un travail de force de base pour poser les fondations",
    ],
    poolTraining: [
      "Sprints courts (5-10 s) avec récupération complète (2-10 min)",
      "A besoin de variété dans le travail de nage (différents stimuli : technique, vitesse, résistance)",
      "Peut intégrer du travail résisté mais plutôt léger",
      "Faible tolérance au travail lactique",
      "Le meilleur moyen de développer son endurance aérobie : intervalles haute intensité ou travail à intensité modérée en changeant régulièrement le focus",
    ],
  },
  "2A": {
    code: "2A",
    name: "Variation",
    fullName: "Le Neurotype VARIATION",
    neurotransmitter: "Adrénaline + Sérotonine",
    motto: "Tout fonctionne, mais rien ne fonctionne longtemps.",
    traits: [
      "Adaptable — peut s'épanouir dans la plupart des conditions d'entraînement",
      "Facilement influencé par l'environnement et le style de coaching",
      "A besoin de changements fréquents pour rester engagé",
      "Peut encaisser un volume élevé mais risque le burn-out mental",
      "Papillon social — ami avec tout le monde, s'adapte à tous les groupes",
      "Motivé par le cadre social de l'entraînement",
      "Extraverti, énergique et communicatif",
    ],
    gymTraining: [
      "Rotation entre différents schémas de répétitions",
      "Alternance de blocs d'entraînement (phases de 3-4 semaines)",
      "Entraînement hybride : mélange de force, d'explosivité et de volume",
      "S'ennuie vite avec un programme trop figé",
      "Répond bien à un cadre structuré mais avec de la variété intégrée",
    ],
    poolTraining: [
      "Capable de gérer aussi bien la haute intensité que l'endurance, mais a besoin de changer régulièrement",
      "Mélanger les focus au sein des séances (technique, vitesse, allure, résistance)",
      "S'épanouit avec un mix de travail résisté, de vitesse et d'allure de course",
      "Profite de l'ambiance de groupe et du cadre social",
      "Se démotive si les séances sont trop répétitives",
    ],
  },
  "2B": {
    code: "2B",
    name: "Sensation",
    fullName: "Le Neurotype SENSATION",
    neurotransmitter: "Sérotonine + GABA",
    motto: "Guidé par les émotions, il s'épanouit quand il se sent fort et connecté.",
    traits: [
      "Guidé par ses émotions et très intuitif",
      "Travaille plus dur quand il se sent respecté et valorisé",
      "Peut avoir tendance à en faire trop s'il pense que cela lui vaudra de la reconnaissance",
      "Peut être en difficulté dans les situations de forte pression",
      "Empathique — ressent intensément les émotions des autres",
      "Fait souvent passer les autres avant lui-même (et le regrette parfois)",
      "Motivé par le sens personnel plutôt que par la compétition pure",
    ],
    gymTraining: [
      "La connexion corps-esprit (mind-muscle connection) est primordiale",
      "Pour la force : répétitions modérées (6-10) avec des tempos lents",
      "Préfère une programmation structurée et prévisible",
      "Aime la sensation d'effort, de « pump » et de brûlure musculaire",
      "A besoin d'une surcharge progressive régulière et méthodique",
    ],
    poolTraining: [
      "Monte en puissance progressivement au fil de la séance — meilleur vers la fin",
      "Aime travailler dur et « sentir » qu'il a bien bossé",
      "Peut encaisser du travail d'endurance mais a besoin de soutien émotionnel",
      "Le travail de vitesse doit être sur des distances plus longues (25-50 m) avec moins de repos",
      "A besoin d'encouragements et d'un cadre bienveillant pour donner le meilleur de lui-même",
    ],
  },
  "3": {
    code: "3",
    name: "Contrôle",
    fullName: "Le Neurotype CONTRÔLE",
    neurotransmitter: "GABA",
    motto: "S'épanouit dans la structure, la précision et la constance.",
    traits: [
      "Très analytique et soucieux du détail",
      "A tendance à trop réfléchir et supporte mal l'imprévu",
      "Préfère la planification à long terme et la structure",
      "N'aime pas prendre de risques — préfère une progression constante et contrôlée",
      "A du mal à baisser sa garde et à faire confiance aux autres",
      "A besoin de se sentir calme et en contrôle pour performer",
      "Introverti, réservé, fidèle à la routine",
    ],
    gymTraining: [
      "Blocs d'entraînement constants (mêmes exercices, même structure pendant plusieurs semaines/mois)",
      "Surcharge progressive graduelle et méthodique",
      "Préfère le travail isométrique et le tempo lent",
      "A besoin de tout connaître à l'avance (exercices, séries, repos)",
      "Se sent déstabilisé par les changements non prévus dans le programme",
    ],
    poolTraining: [
      "A besoin d'échauffements longs et progressifs",
      "Préfère des séries constantes avec un minimum de variation",
      "Peut encaisser un volume élevé d'endurance",
      "Le travail de vitesse doit rester minimal et prévisible",
      "Performe mieux quand il connaît la séance à l'avance et peut s'y préparer mentalement",
    ],
  },
};

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

export const NEUROTYPE_COLORS: Record<NeurotypCode, string> = {
  "1A": "#ef4444", // red-500
  "1B": "#f97316", // orange-500
  "2A": "#eab308", // yellow-500
  "2B": "#22c55e", // green-500
  "3":  "#3b82f6", // blue-500
};
