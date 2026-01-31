# Architecture et fonctionnement du site « Records »

Ce document décrit de manière claire et exhaustive le fonctionnement complet du site **Records** :
- site statique (frontend)
- backend serverless (Cloudflare Worker)
- scraping des données FFN
- cache et déploiement

Il a pour objectif de permettre à toute personne (développeur, mainteneur, futur contributeur) de comprendre rapidement l’architecture et les flux de données.

---

## 1. Vue d’ensemble

Le projet repose sur deux composants principaux :

1. **Un site statique** publié via **GitHub Pages**
2. **Un backend serverless** déployé sur **Cloudflare Workers**

Le site permet de consulter, à partir d’un **IUF**, les données suivantes d’un nageur :
- Meilleures Performances Personnelles (MPP)
- Performances complètes
- en bassin **25 m** et **50 m**

### Principe clé
➡️ **Une seule requête HTTP côté navigateur**  
Le frontend appelle un endpoint unique du backend, qui se charge ensuite de tout le scraping FFN.

---

## 2. Structure du dépôt GitHub

Dépôt : `erstein-aquatic-club/records`

```text
records/
├── docs/                  # Site statique (GitHub Pages)
│   ├── index.html         # Interface utilisateur
│   ├── app.js             # Logique frontend (fetch + rendu)
│   └── README.md
│
├── worker/                # Cloudflare Worker (backend)
│   ├── src/
│   │   └── index.js       # Code principal du worker
│   ├── wrangler.toml      # Configuration Cloudflare
│   ├── package.json       # Dépendances (cheerio, wrangler)
│   └── README.md          # Instructions déploiement
│
└── README.md
