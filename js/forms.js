/* ─────────────────────────────────────────────────────────────
   Catégories d'infrastructures et champs des formulaires.
   Les champs reprennent les colonnes de tes fichiers CSV Kobo
   (Ecole_elementaire.csv, College.csv, Pharmacie.csv, etc.).
   Pour ajouter / retirer un champ : modifie simplement la liste
   `fields` de la catégorie concernée (k = clé interne, l = libellé
   affiché ET nom de colonne dans l'Excel).
   Types : text | number | select | date | time | textarea
   ───────────────────────────────────────────────────────────── */
window.QUARTIERS = ['Croisement TP', 'Daral', 'Darou Salam', 'Émetteurs', 'Escale', 'Logandème', 'Mboubane', 'Ndiandiaye 1', 'Ndiandiaye 2', 'Ndouck', 'Peulga', 'Poukham'];

const STATUT = { k: 'statut', l: 'Statut', t: 'select', o: ['Public', 'Privé'] };
const DATE_CREA = { k: 'date_creation', l: 'Date de creation', t: 'date' };

const F_EDU = [
  { k: 'nb_enseignants', l: 'Nb enseignants', t: 'number' },
  { k: 'nb_eleves', l: 'Nb eleves', t: 'number' },
  { k: 'nb_salles', l: 'Nb de salles de classe', t: 'number' },
  { k: 'nb_classes', l: 'Nb classes pedagogiques', t: 'number' },
];
const F_SANTE = [
  { k: 'nb_medecins', l: 'Nb de medecins', t: 'number' },
  { k: 'nb_infirmiers', l: 'Nb infirmiers', t: 'number' },
  { k: 'nb_sages_femmes', l: 'Nb de sages femmes', t: 'number' },
  { k: 'nb_aides_soignants', l: 'Nb aides soignants', t: 'number' },
  { k: 'nb_salles_accouchement', l: 'Nb salles accouchement', t: 'number' },
  { k: 'nb_salles_consultation', l: 'Nb salles consultation', t: 'number' },
];

window.CATS = {
  ecole_elementaire: { label: 'École élémentaire', sheet: 'Ecole_elementaire', emoji: '🏫', color: '#0d5c46', type: 'Elementaire', fields: [...F_EDU, STATUT, DATE_CREA] },
  ecole_prescolaire: { label: 'École préscolaire', sheet: 'Ecole_prescolaire', emoji: '🧒', color: '#a16207', type: 'Prescolaire',
    fields: [{ k: 'nb_enseignants', l: 'Nb enseignants', t: 'number' }, { k: 'nb_eleves', l: 'Nb eleves', t: 'number' }, { k: 'nb_salles', l: 'Nb de salles de classe', t: 'number' },
      { k: 'h_francais', l: 'Heures français', t: 'number' }, { k: 'h_arabe', l: 'Heures arabe', t: 'number' }, STATUT, DATE_CREA] },
  college: { label: 'Collège', sheet: 'College', emoji: '🎒', color: '#831843', type: 'Collège', fields: [...F_EDU, STATUT, DATE_CREA] },
  lycee: { label: 'Lycée', sheet: 'Lycee', emoji: '🎓', color: '#9a3412', type: 'Secondaire', fields: [...F_EDU, STATUT, DATE_CREA] },
  centre_sante: { label: 'Centre de santé', sheet: 'Centre_de_sante', emoji: '🏥', color: '#2563eb', type: 'Centre de santé', fields: [...F_SANTE, STATUT, DATE_CREA] },
  poste_sante: { label: 'Poste de santé', sheet: 'Poste_de_sante', emoji: '⚕️', color: '#0e7490', type: 'Poste de santé', fields: [...F_SANTE, STATUT, DATE_CREA] },
  hopital: { label: 'Hôpital', sheet: 'Hopital', emoji: '🏨', color: '#7c3aed', type: 'Hopital regional', fields: [...F_SANTE, STATUT, DATE_CREA] },
  pharmacie: { label: 'Pharmacie', sheet: 'Pharmacie', emoji: '💊', color: '#16a34a', type: 'Pharmacie',
    fields: [{ k: 'nom_pharmacie', l: 'Nom de la pharmacie', t: 'text' }, { k: 'h_ouverture', l: 'Heures ouverture', t: 'time' }, { k: 'h_fermeture', l: 'Heures de fermeture', t: 'time' }, STATUT, DATE_CREA] },
  // Hydraulique : pas de fiche dans tes CSV → champs génériques, à adapter ici si besoin
  chateau_eau: { label: 'Château d’eau', sheet: 'Chateau_eau', emoji: '🚰', color: '#155e75', type: 'Château d’eau',
    fields: [{ k: 'etat', l: 'Etat', t: 'select', o: ['Fonctionnel', 'En panne', 'Hors service'] }, STATUT, DATE_CREA] },
  forage: { label: 'Forage', sheet: 'Forage', emoji: '💧', color: '#0891b2', type: 'Forage',
    fields: [{ k: 'etat', l: 'Etat', t: 'select', o: ['Fonctionnel', 'En panne', 'Hors service'] }, STATUT, DATE_CREA] },
};

/* Champs communs, placés avant / après les champs propres à chaque catégorie */
window.COMMON_BEFORE = [
  { k: 'quartier', l: 'Quartier', t: 'select', o: window.QUARTIERS },
  { k: 'enqueteur', l: 'Enqueteur', t: 'text' },
  { k: 'nom', l: 'Nom etablissement', t: 'text' },
];
window.COMMON_AFTER = [
  { k: 'observations', l: 'Observations', t: 'textarea' },
];
