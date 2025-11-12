/**
 * Import Kreditoren from CSV
 * Usage: node scripts/import-kreditoren.js
 */

const fs = require('fs');
const path = require('path');

async function importKreditoren() {
  try {
    // CSV-Daten (aus der hochgeladenen Datei)
    const csvData = `69001;Amazon Payment;1
4320;EU-Umsätze OSS steuerpflichtig;2
70000;Lieferant;4
70001;Haufe Service Center GmbH;4
70002;Mobility Concept GmbH;4
70003;Daniel Ali (SHOPSY);4
70004;Klingspor Management GmbH & Co. KG;4
70005;Rüggeberg August GmbH & Co. KG;4
70006;Starcke GmbH & Co. KG;4
70007;DPD Deutschland GmbH Depot;4
70008;Händlerbund Management AG;4
70009;VSM;4
70010;LUKAS-ERZETT GmbH & Co. KG;4
70011;Tankstelle;4
70012;ALDI Süd;4
70013;Rewe;4
70014;Der Grüne Punkt - Duales System Deutschland GmbH;4
70015;MK Plastimex;4
70016;Sendinblue GMBH;4
70017;Anatole Serexhe;4
70018;NISSEN Klebetechnik GmbH & Co. KG;4
70019;Postbank;4
70020;Santander Consumer Bank AG;4
70021;Axa Versicherung;4
70022;Telekom Deutschland GmbH;4
70023;STRATO;4
70024;Hetzner Online GmbH;4
70025;Lieferant;4
70026;Lieferant;4
70027;Lieferant;4
70028;Lieferant;4
70029;Lieferant;4
70030;Amazon Logistics;4
70031;André Schäfer;4
70032;Werkstatt Holger Stölting;4
70033;PKK Pinneberg;4
70034;TÜV Rheinland;4
70035;TruckNorte;4
70036;Adler;4
70037;Postbank;4
70038;Lieferant;4
70039;Lieferant;4
70040;Vierol AG Gebäudetechnik;4
70041;DKV;4
70042;Commerzbank;4
70043;Finanzamt Köln-Altstadt;4
70044;Landeskartellbehörde NRW;4
70045;BG Holz und Metall;4
70046;Aral;4
70047;Kaufland;4
70048;Bauhaus;4
70049;Praktiker;4
70050;DHL;4
70051;Lieferant;4
70052;GEMA;4
70053;Lieferant;4
70054;Lieferant;4
70055;Lieferant;4
70056;Lieferant;4
70057;Lieferant;4
70058;Lieferant;4
70059;Lieferant;4
70060;Lieferant;4
70061;Lieferant;4
70062;Lieferant;4
70063;Lieferant;4
70064;Lieferant;4
70065;Lieferant;4
70066;Lieferant;4
70067;Lieferant;4
70068;Lieferant;4
70069;Lieferant;4
70070;Lieferant;4
70071;Lieferant;4
70072;Lieferant;4
70073;Lieferant;4
70074;Lieferant;4
70075;Lieferant;4
70076;Lieferant;4
70077;Lieferant;4
70078;Lieferant;4
70079;Lieferant;4
70080;Lieferant;4
70081;Lieferant;4
70082;Lieferant;4
70083;Lieferant;4
70084;Lieferant;4
70085;Lieferant;4
70086;Lieferant;4
70087;Lieferant;4
70088;Lieferant;4
70089;Lieferant;4
70090;Lieferant;4
70091;Lieferant;4
70092;Lieferant;4
70093;Lieferant;4
70094;Lieferant;4
70095;Lieferant;4
70096;Lieferant;4
70097;Lieferant;4
70098;Lieferant;4
70099;Lieferant;4
70100;Lieferant;4
70101;Lieferant;4
70102;Lieferant;4
70103;Lieferant;4
70104;Lieferant;4
70105;Lieferant;4
70106;Lieferant;4
70107;Lieferant;4
70108;Lieferant;4
70109;Lieferant;4
70110;Lieferant;4
70194;PB Trading;4
70195;Easy Cash;4
70196;2ndsoft.de;4
70197;Idealo;4
70198;MH Steel;4
70199;Rocket-Media Gmbh & Co Kg;4
70200;Lieferant;4
70201;Lieferant;4
74399;Neues Konto;4
75020;Neues Konto;4
75544;Neues Konto;4
76837;Lieferant;4
79000;Neues Konto;4`;

    const lines = csvData.trim().split('\n');
    const kreditoren = [];
    
    // Standard-Aufwandskonten Mapping
    const aufwandskontenMapping = {
      'Amazon': '6600', // Werbung
      'Idealo': '6600', // Werbung
      'Rocket-Media': '6600', // Werbung
      'DPD': '6300', // Versandkosten
      'DHL': '6300', // Versandkosten
      'Tankstelle': '6530', // Kraftstoff
      'Aral': '6530', // Kraftstoff
      'ALDI': '6610', // Bürobedarf/Kleinmaterial
      'Rewe': '6610', // Bürobedarf/Kleinmaterial
      'Kaufland': '6610',
      'Bauhaus': '6610',
      'Telekom': '6805', // Telefon
      'STRATO': '6815', // IT/Software
      'Hetzner': '6815', // IT/Server
      'Postbank': '6850', // Bankgebühren
      'Commerzbank': '6850', // Bankgebühren
      'Santander': '6850', // Bankgebühren
      'Versicherung': '6640', // Versicherungen
      'Axa': '6640', // Versicherungen
      'Finanzamt': '6510', // Steuern
      'GEMA': '6823', // Lizenzgebühren
      'TÜV': '6520', // Gebühren
    };
    
    for (const line of lines) {
      const [kreditorenNummer, name, typ] = line.split(';');
      
      if (!kreditorenNummer || !name) continue;
      
      // Standard-Aufwandskonto bestimmen
      let standardAufwandskonto = '5200'; // Default: Wareneinkauf
      
      // Suche nach bekannten Stichwörtern
      for (const [stichwort, konto] of Object.entries(aufwandskontenMapping)) {
        if (name.toLowerCase().includes(stichwort.toLowerCase())) {
          standardAufwandskonto = konto;
          break;
        }
      }
      
      // Spezielle Hersteller → Wareneinkauf
      if (name.includes('Klingspor') || name.includes('Starcke') || 
          name.includes('VSM') || name.includes('LUKAS') || 
          name.includes('Rüggeberg') || name.includes('NISSEN')) {
        standardAufwandskonto = '5200';
      }
      
      kreditoren.push({
        kreditorenNummer,
        name: name.trim(),
        standardAufwandskonto
      });
    }
    
    console.log(`Parsed ${kreditoren.length} Kreditoren`);
    
    // Import via API
    const response = await fetch('http://localhost:3000/api/fibu/kreditoren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kreditoren)
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log(`✅ ${result.message}`);
      console.log(`Details: ${result.results.filter(r => r.upserted).length} neu, ${result.results.filter(r => r.modified).length} aktualisiert`);
    } else {
      console.error(`❌ Fehler: ${result.error}`);
    }
  } catch (error) {
    console.error('Import-Fehler:', error);
  }
}

importKreditoren();
