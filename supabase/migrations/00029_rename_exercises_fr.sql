-- Migration: Rename English exercise names to French (keep gym jargon in English)
-- Date: 2026-02-24

UPDATE dim_exercices SET nom_exercice = 'Soulevé de terre roumain' WHERE id = 3;
UPDATE dim_exercices SET nom_exercice = 'Rowing haltères incliné' WHERE id = 4;
UPDATE dim_exercices SET nom_exercice = 'Squat avant' WHERE id = 6;
UPDATE dim_exercices SET nom_exercice = 'Soulevé de terre trap bar' WHERE id = 7;
-- id=8 Box Jump: kept in English (gym jargon)
UPDATE dim_exercices SET nom_exercice = 'Lancer de médecine-ball' WHERE id = 9;
UPDATE dim_exercices SET nom_exercice = 'Straight-Arm Pulldown barre (schéma papillon)' WHERE id = 12;
UPDATE dim_exercices SET nom_exercice = 'Rowing unilatéral haltère' WHERE id = 18;
UPDATE dim_exercices SET nom_exercice = 'Squat sauté chargé léger' WHERE id = 20;
UPDATE dim_exercices SET nom_exercice = 'Saut en longueur' WHERE id = 21;
UPDATE dim_exercices SET nom_exercice = 'Relevés de jambes suspendu' WHERE id = 23;
UPDATE dim_exercices SET nom_exercice = 'Développé incliné haltères avec rotation' WHERE id = 25;
UPDATE dim_exercices SET nom_exercice = 'Squat arrière' WHERE id = 26;
UPDATE dim_exercices SET nom_exercice = 'Squat sauté' WHERE id = 27;
UPDATE dim_exercices SET nom_exercice = 'Flexion ischio-jambiers' WHERE id = 28;
UPDATE dim_exercices SET nom_exercice = 'Presse à cuisses' WHERE id = 29;
-- id=30 Farmer Walk: kept in English (gym jargon)
UPDATE dim_exercices SET nom_exercice = 'Squat bulgare' WHERE id = 33;
-- id=34 Step-Up: kept in English (gym jargon)
UPDATE dim_exercices SET nom_exercice = 'Fente inversée' WHERE id = 35;
UPDATE dim_exercices SET nom_exercice = 'Soulevé de terre roumain unilat.' WHERE id = 36;
UPDATE dim_exercices SET nom_exercice = 'Fente latérale' WHERE id = 37;
UPDATE dim_exercices SET nom_exercice = 'Curl nordique' WHERE id = 38;
UPDATE dim_exercices SET nom_exercice = 'Flexion ischio-jambiers glissée' WHERE id = 39;
UPDATE dim_exercices SET nom_exercice = 'Extension dorsale 45°' WHERE id = 40;
UPDATE dim_exercices SET nom_exercice = 'Mollets debout' WHERE id = 41;
UPDATE dim_exercices SET nom_exercice = 'Mollets assis (soléaire)' WHERE id = 42;
-- id=43 Pogo Hops: kept in English (gym jargon)
UPDATE dim_exercices SET nom_exercice = 'Maintien isométrique cheville' WHERE id = 44;
-- id=45 Pallof Press: kept in English (proper name)
UPDATE dim_exercices SET nom_exercice = 'Planche latérale' WHERE id = 47;
-- id=48 Suitcase Carry: kept in English (gym jargon)
-- id=49 Face Pull: kept in English (gym jargon)
UPDATE dim_exercices SET nom_exercice = 'Rotation externe épaule (câble/élastique)' WHERE id = 50;
-- id=51 Serratus Wall Slide: kept in English (gym jargon)
UPDATE dim_exercices SET nom_exercice = 'Pompe scapulaire (Scap Push-Up)' WHERE id = 52;
UPDATE dim_exercices SET nom_exercice = 'Lancer rotatif médecine-ball' WHERE id = 53;
UPDATE dim_exercices SET nom_exercice = 'Lancer latéral médecine-ball' WHERE id = 54;
UPDATE dim_exercices SET nom_exercice = 'Lancer type poids médecine-ball' WHERE id = 55;
-- id=56 Drop Jump to Stick: kept in English (gym jargon)
UPDATE dim_exercices SET nom_exercice = 'Maintien isométrique fente' WHERE id = 57;
UPDATE dim_exercices SET nom_exercice = 'Planche Copenhague' WHERE id = 58;
-- id=59 Hip Airplane: kept in English (gym jargon)
