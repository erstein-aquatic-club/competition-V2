-- Migration: Rename all English exercise names to French
-- Date: 2026-02-24

UPDATE dim_exercices SET nom_exercice = 'Soulevé de terre roumain' WHERE id = 3;
UPDATE dim_exercices SET nom_exercice = 'Rowing haltères incliné' WHERE id = 4;
UPDATE dim_exercices SET nom_exercice = 'Squat avant' WHERE id = 6;
UPDATE dim_exercices SET nom_exercice = 'Soulevé de terre trap bar' WHERE id = 7;
UPDATE dim_exercices SET nom_exercice = 'Saut sur box' WHERE id = 8;
UPDATE dim_exercices SET nom_exercice = 'Lancer de médecine-ball' WHERE id = 9;
UPDATE dim_exercices SET nom_exercice = 'Straight-Arm Pulldown barre (schéma papillon)' WHERE id = 12;
UPDATE dim_exercices SET nom_exercice = 'Tirage vertical prise neutre' WHERE id = 16; -- already FR, no change needed but ensuring consistency
UPDATE dim_exercices SET nom_exercice = 'Rowing unilatéral haltère' WHERE id = 18;
UPDATE dim_exercices SET nom_exercice = 'Pull-over barre' WHERE id = 19; -- already FR
UPDATE dim_exercices SET nom_exercice = 'Squat sauté chargé léger' WHERE id = 20;
UPDATE dim_exercices SET nom_exercice = 'Saut en longueur' WHERE id = 21;
UPDATE dim_exercices SET nom_exercice = 'Hip Thrust explosif' WHERE id = 22; -- keep as-is, well-known term
UPDATE dim_exercices SET nom_exercice = 'Relevés de jambes suspendu' WHERE id = 23;
UPDATE dim_exercices SET nom_exercice = 'Développé incliné haltères avec rotation' WHERE id = 25;
UPDATE dim_exercices SET nom_exercice = 'Squat arrière' WHERE id = 26;
UPDATE dim_exercices SET nom_exercice = 'Squat sauté' WHERE id = 27;
UPDATE dim_exercices SET nom_exercice = 'Flexion ischio-jambiers' WHERE id = 28;
UPDATE dim_exercices SET nom_exercice = 'Presse à cuisses' WHERE id = 29;
UPDATE dim_exercices SET nom_exercice = 'Marche du fermier' WHERE id = 30;
UPDATE dim_exercices SET nom_exercice = 'Squat bulgare' WHERE id = 33;
UPDATE dim_exercices SET nom_exercice = 'Montée sur banc' WHERE id = 34;
UPDATE dim_exercices SET nom_exercice = 'Fente inversée' WHERE id = 35;
UPDATE dim_exercices SET nom_exercice = 'Soulevé de terre roumain unilat.' WHERE id = 36;
UPDATE dim_exercices SET nom_exercice = 'Fente latérale' WHERE id = 37;
UPDATE dim_exercices SET nom_exercice = 'Curl nordique' WHERE id = 38;
UPDATE dim_exercices SET nom_exercice = 'Flexion ischio-jambiers glissée' WHERE id = 39;
UPDATE dim_exercices SET nom_exercice = 'Extension dorsale 45°' WHERE id = 40;
UPDATE dim_exercices SET nom_exercice = 'Mollets debout' WHERE id = 41;
UPDATE dim_exercices SET nom_exercice = 'Mollets assis (soléaire)' WHERE id = 42;
UPDATE dim_exercices SET nom_exercice = 'Sauts courts (Pogo)' WHERE id = 43;
UPDATE dim_exercices SET nom_exercice = 'Maintien isométrique cheville' WHERE id = 44;
UPDATE dim_exercices SET nom_exercice = 'Presse Pallof' WHERE id = 45;
UPDATE dim_exercices SET nom_exercice = 'Dead Bug' WHERE id = 46; -- well-known term, keep as-is
UPDATE dim_exercices SET nom_exercice = 'Planche latérale' WHERE id = 47;
UPDATE dim_exercices SET nom_exercice = 'Portage valise' WHERE id = 48;
UPDATE dim_exercices SET nom_exercice = 'Tirage visage' WHERE id = 49;
UPDATE dim_exercices SET nom_exercice = 'Rotation externe épaule (câble/élastique)' WHERE id = 50;
UPDATE dim_exercices SET nom_exercice = 'Glissé mural dentelé' WHERE id = 51;
UPDATE dim_exercices SET nom_exercice = 'Pompe scapulaire (Scap Push-Up)' WHERE id = 52;
UPDATE dim_exercices SET nom_exercice = 'Lancer rotatif médecine-ball' WHERE id = 53;
UPDATE dim_exercices SET nom_exercice = 'Lancer latéral médecine-ball' WHERE id = 54;
UPDATE dim_exercices SET nom_exercice = 'Lancer type poids médecine-ball' WHERE id = 55;
UPDATE dim_exercices SET nom_exercice = 'Saut en contrebas (réception bloquée)' WHERE id = 56;
UPDATE dim_exercices SET nom_exercice = 'Maintien isométrique fente' WHERE id = 57;
UPDATE dim_exercices SET nom_exercice = 'Planche Copenhague' WHERE id = 58;
UPDATE dim_exercices SET nom_exercice = 'Avion de hanche' WHERE id = 59;
