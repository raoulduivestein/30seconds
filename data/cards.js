const categories = [
  ["Bekende personen", ["Max Verstappen", "Andre Hazes", "Koning Willem-Alexander", "Linda de Mol", "Johan Cruijff", "Duncan Laurence", "Ilse DeLange", "Arjen Lubach", "NikkieTutorials", "Chantal Janzen"]],
  ["Films en series", ["Netflix", "Boer zoekt Vrouw", "Flikken Maastricht", "Avatar", "The Voice", "Penoza", "Wie is de Mol", "Star Wars", "Harry Potter", "Undercover"]],
  ["Sport", ["Voetbal", "Schaatsen", "Ajax", "Feyenoord", "Tour de France", "Olympische Spelen", "Tennis", "Darten", "Formule 1", "Hockey"]],
  ["Dieren", ["Kat", "Hond", "Koe", "Paard", "Pinguin", "Olifant", "Kikker", "Zeehond", "Papegaai", "Konijn"]],
  ["Eten en drinken", ["Stroopwafel", "Pannenkoek", "Frikandel", "Bitterbal", "Hagelslag", "Kibbeling", "Drop", "Erwtensoep", "Kaas", "Koffie"]],
  ["Plaatsen", ["Schiphol", "Eiffeltoren", "Amsterdam", "Rotterdam", "Texel", "Utrecht", "Maastricht", "De Kuip", "Zandvoort", "Groningen"]],
  ["Muziek", ["Karaoke", "Gitaar", "Eurovisie", "DJ", "Spotify", "Concert", "Drumstel", "Piano", "Festival", "Smartlap"]],
  ["Dagelijkse voorwerpen", ["Bakfiets", "Sleutelbos", "Afstandsbediening", "Paraplu", "Tandenborstel", "Laptop", "Bril", "Fietspomp", "Boodschappentas", "Wekker"]],
  ["Spreekwoorden", ["Hoge bomen vangen veel wind", "De kat uit de boom kijken", "Met de deur in huis vallen", "Iets onder de knie hebben", "Door de mand vallen", "Water bij de wijn doen", "De appel valt niet ver van de boom", "Een oogje dichtknijpen", "Oost west thuis best", "Na regen komt zonneschijn"]],
  ["Nederlandse cultuur", ["Koningsdag", "Sinterklaas", "Elfstedentocht", "Fietspad", "Deltawerken", "Molens", "Grachten", "Beschuit met muisjes", "Vrijmarkt", "Oranjegekte"]],
  ["Gekke categorieen", ["Glitterpak", "Luchtgitaar", "Kussengevecht", "Dansende plant", "Verdwaalde sok", "Confettikanon", "Snurkconcert", "Broodje hagelslag met augurk", "Wandelende koelkast", "Koffie zonder kopje"]],
  ["Clubhouse en online community", ["Clubhouse-room", "Moderator", "Mute-knop", "Hand opsteken", "Backchannel", "Volgers", "Online meetup", "Profielbio", "Roomlink", "Community"]]
];

export const cards = Array.from({ length: 200 }, (_, index) => {
  const category = categories[index % categories.length];
  const start = (index * 3) % category[1].length;
  const nextCategory = categories[(index + 3) % categories.length][1];
  const words = [
    category[1][start],
    category[1][(start + 1) % category[1].length],
    nextCategory[(start + 2) % nextCategory.length],
    categories[(index + 5) % categories.length][1][(start + 3) % 10],
    categories[(index + 8) % categories.length][1][(start + 4) % 10]
  ];
  return {
    id: `kaart-${String(index + 1).padStart(3, "0")}`,
    categorie: category[0],
    category: category[0],
    difficulty: index % 5 === 0 ? "moeilijk" : index % 2 === 0 ? "normaal" : "makkelijk",
    moeilijkheidsgraad: index % 5 === 0 ? "moeilijk" : index % 2 === 0 ? "normaal" : "makkelijk",
    words,
    woorden: words,
    status: "actief"
  };
});
