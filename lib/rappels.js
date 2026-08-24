const API_URL =
  "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records/?limit=100&order_by=date_publication%20desc";

const MOTS_CLES_BEBE = [
  "bébé", "bebe", "nourrisson", "infantile", "puéricultur",
  "biberon", "couche", "poussette", "lait 1er", "lait 2e",
  "lait infantile", "tétine", "sucette", "jouet",
];

export async function fetchRappelsBebe() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error("Impossible de récupérer les rappels");
  const json = await res.json();
  const tousLesRappels = json.results || [];

  return tousLesRappels.filter((r) => {
    const texte = [
      r.categorie_de_produit,
      r.sous_categorie_de_produit,
      r.noms_des_modeles_ou_references,
      r.marque_produit,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return MOTS_CLES_BEBE.some((mot) => texte.includes(mot));
  });
}
