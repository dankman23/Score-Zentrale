/**
 * Branchen und Regionen für Kaltakquise
 */

export const BRANCHEN = [
  // Metallverarbeitung
  { value: 'Metallbau', label: '🔩 Metallbau' },
  { value: 'Stahlbau', label: '🏭 Stahlbau' },
  { value: 'Edelstahlverarbeitung', label: '✨ Edelstahlverarbeitung' },
  { value: 'Maschinenbau', label: '⚙️ Maschinenbau' },
  { value: 'Anlagenbau', label: '🏭 Anlagenbau' },
  { value: 'Schlosserei', label: '🔑 Schlosserei' },
  { value: 'Schweißtechnik', label: '🔥 Schweißtechnik' },
  
  // Automotive
  { value: 'Karosseriebau', label: '🚗 Karosseriebau' },
  { value: 'Automotive Zulieferer', label: '🚙 Automotive Zulieferer' },
  
  // Holzverarbeitung
  { value: 'Schreinerei', label: '🪵 Schreinerei' },
  { value: 'Tischlerei', label: '🪵 Tischlerei' },
  { value: 'Möbelbau', label: '🛋️ Möbelbau' },
  { value: 'Holzbearbeitung', label: '🌲 Holzbearbeitung' },
  
  // Oberflächenbearbeitung
  { value: 'Lackiererei', label: '🎨 Lackiererei' },
  { value: 'Oberflächentechnik', label: '✨ Oberflächentechnik' },
  { value: 'Schleiferei', label: '🔩 Schleiferei' },
  { value: 'Poliererei', label: '✨ Poliererei' },
  
  // Fertigung
  { value: 'Fertigungsbetrieb', label: '🏭 Fertigungsbetrieb' },
  { value: 'Industriebetrieb', label: '🏭 Industriebetrieb' },
  { value: 'Werkstatt', label: '🔧 Werkstatt' },
]

export const BUNDESLAENDER_MIT_STAEDTEN = [
  {
    bundesland: 'Baden-Württemberg',
    staedte: ['Stuttgart', 'Mannheim', 'Karlsruhe', 'Freiburg', 'Heidelberg', 'Ulm', 'Heilbronn', 'Pforzheim', 'Reutlingen', 'Esslingen']
  },
  {
    bundesland: 'Bayern',
    staedte: ['München', 'Nürnberg', 'Augsburg', 'Regensburg', 'Ingolstadt', 'Würzburg', 'Fürth', 'Erlangen', 'Bayreuth', 'Bamberg']
  },
  {
    bundesland: 'Berlin',
    staedte: ['Berlin']
  },
  {
    bundesland: 'Brandenburg',
    staedte: ['Potsdam', 'Cottbus', 'Brandenburg an der Havel', 'Frankfurt (Oder)', 'Oranienburg', 'Fürstenwalde', 'Eberswalde', 'Strausberg', 'Bernau', 'Hennigsdorf']
  },
  {
    bundesland: 'Bremen',
    staedte: ['Bremen', 'Bremerhaven']
  },
  {
    bundesland: 'Hamburg',
    staedte: ['Hamburg']
  },
  {
    bundesland: 'Hessen',
    staedte: ['Frankfurt am Main', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach', 'Hanau', 'Gießen', 'Marburg', 'Fulda', 'Rüsselsheim']
  },
  {
    bundesland: 'Mecklenburg-Vorpommern',
    staedte: ['Rostock', 'Schwerin', 'Neubrandenburg', 'Stralsund', 'Greifswald', 'Wismar', 'Güstrow', 'Neustrelitz', 'Waren', 'Pärchim']
  },
  {
    bundesland: 'Niedersachsen',
    staedte: ['Hannover', 'Braunschweig', 'Osnabrück', 'Oldenburg', 'Wolfsburg', 'Göttingen', 'Salzgitter', 'Hildesheim', 'Delmenhorst', 'Wilhelmshaven']
  },
  {
    bundesland: 'Nordrhein-Westfalen',
    staedte: ['Köln', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg', 'Bochum', 'Wuppertal', 'Bielefeld', 'Bonn', 'Münster']
  },
  {
    bundesland: 'Rheinland-Pfalz',
    staedte: ['Mainz', 'Ludwigshafen', 'Koblenz', 'Trier', 'Kaiserslautern', 'Worms', 'Neuwied', 'Speyer', 'Landau', 'Bad Kreuznach']
  },
  {
    bundesland: 'Saarland',
    staedte: ['Saarbrücken', 'Neunkirchen', 'Homburg', 'Völklingen', 'Sankt Ingbert', 'Saarlou is', 'Merzig', 'St. Wendel', 'Blieskastel', 'Dillingen']
  },
  {
    bundesland: 'Sachsen',
    staedte: ['Leipzig', 'Dresden', 'Chemnitz', 'Zwickau', 'Plauen', 'Görlitz', 'Freiberg', 'Bautzen', 'Freital', 'Pirna']
  },
  {
    bundesland: 'Sachsen-Anhalt',
    staedte: ['Magdeburg', 'Halle (Saale)', 'Dessau-Roßlau', 'Wittenberg', 'Quedlinburg', 'Halberstadt', 'Wernigerode', 'Stendal', 'Sangerhausen', 'Bitterfeld-Wolfen']
  },
  {
    bundesland: 'Schleswig-Holstein',
    staedte: ['Kiel', 'Lübeck', 'Flensburg', 'Neumünster', 'Norderstedt', 'Elmshorn', 'Pinneberg', 'Itzehoe', 'Wedel', 'Ahrensburg']
  },
  {
    bundesland: 'Thüringen',
    staedte: ['Erfurt', 'Jena', 'Gera', 'Weimar', 'Gotha', 'Nordhausen', 'Eisenach', 'Suhl', 'Altenburg', 'Mühlhausen']
  }
]

// Alle Regionen als flache Liste
export const REGIONEN = [
  ...BUNDESLAENDER_MIT_STAEDTEN.map(b => ({
    value: b.bundesland,
    label: `📍 ${b.bundesland}`,
    type: 'bundesland' as const
  })),
  ...BUNDESLAENDER_MIT_STAEDTEN.flatMap(b => 
    b.staedte.map(s => ({
      value: s,
      label: `🏛️ ${s}`,
      type: 'stadt' as const,
      bundesland: b.bundesland
    }))
  )
]

// Gruppierte Regionen für bessere UX
export const REGIONEN_GRUPPIERT = [
  {
    label: '📍 Bundesländer',
    options: BUNDESLAENDER_MIT_STAEDTEN.map(b => ({
      value: b.bundesland,
      label: b.bundesland
    }))
  },
  ...BUNDESLAENDER_MIT_STAEDTEN.map(b => ({
    label: `🏛️ ${b.bundesland} - Städte`,
    options: b.staedte.map(s => ({
      value: s,
      label: s
    }))
  }))
]
