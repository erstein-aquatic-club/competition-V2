# Design : Notification SMS après envoi d'entretien

## Contexte

Quand le coach envoie un entretien au nageur (`sendInterviewToAthlete`), aucune notification n'est déclenchée. Le nageur ne sait pas qu'un entretien l'attend sauf s'il ouvre manuellement l'app.

## Objectif

Après l'envoi d'un entretien, afficher un dialog proposant d'envoyer un SMS au nageur avec un lien direct vers la section entretiens.

## Flow UX

1. Coach clique "Envoyer au nageur" (bouton existant dans `SwimmerInterviewsTab`)
2. L'entretien passe en status `sent` (comportement actuel inchangé)
3. **Nouveau** : Un `AlertDialog` apparaît :
   - Titre : "Entretien envoyé"
   - Message : "L'entretien a bien été envoyé à [Prénom]. Voulez-vous le notifier par SMS ?"
   - Bouton primaire : "Envoyer le SMS" (ouvre Messages/SMS natif)
   - Bouton secondaire : "Plus tard"

## Contenu SMS (fixe, pré-rempli)

```
Bonjour [Prénom], ton entretien est disponible. Consulte-le ici : https://erstein-aquatic-club.github.io/competition/#/profile
```

## Mécanisme d'envoi

Identique à `CoachSmsScreen` :
- **Mobile (iOS/Android)** : Ouvre l'app SMS native via `sms://` avec numéro + body
- **Mac (Messages relay iPhone)** : Ouvre l'app Messages via `sms://`
- **Autre desktop** : Copie numéro + message dans le presse-papier avec toast

## Cas limites

- **Pas de numéro** : Dialog indique "Aucun numéro enregistré" + bouton SMS désactivé
- **Fermeture dialog** : L'entretien est déjà envoyé, rien n'est bloqué

## Fichiers modifiés

- `src/pages/coach/SwimmerInterviewsTab.tsx` : State dialog + logique SMS après `sendMutation.onSuccess`
- `src/lib/smsUtils.ts` (nouveau) : Helper `buildSmsUri(phone, body)` extrait du pattern `CoachSmsScreen`
- `src/pages/coach/CoachSmsScreen.tsx` : Refactor pour utiliser le helper partagé

## Pas de modification

- Pas de backend / Edge Function
- Pas de nouveau composant UI (AlertDialog Shadcn existant)
- Pas de changement dans le flow d'envoi d'entretien
