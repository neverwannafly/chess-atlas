/** Lookup tables for Indian states / UTs and major cities. Keys are normalised via `norm()`. */

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** canonical state -> aliases (abbreviations, spellings, misspellings). */
const STATE_ALIASES: Record<string, string[]> = {
  "Andhra Pradesh": ["AP", "Andhra", "Andra Pradesh", "Andhrapradesh"],
  "Arunachal Pradesh": ["AR", "Arunachal", "Arunachalpradesh"],
  Assam: ["AS", "Asam"],
  Bihar: ["BR", "Behar"],
  Chhattisgarh: ["CG", "Chattisgarh", "Chhatisgarh", "Chattishgarh", "Chhattishgarh", "CT"],
  Goa: ["GA"],
  Gujarat: ["GJ", "Gujrat", "Gujarath"],
  Haryana: ["HR", "Hariyana"],
  "Himachal Pradesh": ["HP", "Himachal", "Himanchal Pradesh"],
  Jharkhand: ["JH", "Jharkand"],
  Karnataka: ["KA", "KAR", "Karnatka", "Karnataka State"],
  Kerala: ["KL", "Kerela", "Keralam"],
  "Madhya Pradesh": ["MP", "Madhyapradesh", "Madhya Pradhesh"],
  Maharashtra: ["MH", "Maharastra", "Maharashta", "Maharashtra State"],
  Manipur: ["MN"],
  Meghalaya: ["ML"],
  Mizoram: ["MZ"],
  Nagaland: ["NL"],
  Odisha: ["OD", "OR", "Orissa"],
  Punjab: ["PB", "Panjab"],
  Rajasthan: ["RJ", "Rajastan", "Rajsthan"],
  Sikkim: ["SK"],
  "Tamil Nadu": ["TN", "Tamilnadu", "Tamil Nadu State", "Tamilnad", "Tamil Nadu India"],
  Telangana: ["TS", "TG", "Telengana", "Telangna"],
  Tripura: ["TR"],
  "Uttar Pradesh": ["UP", "Uttarpradesh", "Utter Pradesh"],
  Uttarakhand: ["UK", "UA", "Uttaranchal", "Uttrakhand"],
  "West Bengal": ["WB", "Bengal", "W Bengal", "West Bangal"],
  "Andaman and Nicobar Islands": ["AN", "A and N Islands", "Andaman", "Andaman Nicobar", "Andaman and Nicobar"],
  Chandigarh: ["CHD"],
  "Dadra and Nagar Haveli and Daman and Diu": ["DN", "DD", "Daman and Diu", "Daman", "Diu", "Dadra and Nagar Haveli", "Dadra Nagar Haveli"],
  Delhi: ["DL", "New Delhi", "NCT of Delhi", "NCT Delhi", "Delhi NCR", "NCR", "National Capital Region"],
  "Jammu and Kashmir": ["JK", "J and K", "Kashmir", "Jammu Kashmir"],
  Ladakh: ["LA"],
  Lakshadweep: ["LD"],
  Puducherry: ["PY", "Pondicherry", "Pondy", "Puducherry UT"],
};

/** Single-city UTs: when only the UT is given, city = UT name. */
export const CITY_STATES = new Set(["Delhi", "Chandigarh", "Puducherry"]);

const stateLookup = new Map<string, string>();
for (const [canon, aliases] of Object.entries(STATE_ALIASES)) {
  stateLookup.set(norm(canon), canon);
  for (const a of aliases) stateLookup.set(norm(a), canon);
}

export const STATES = Object.keys(STATE_ALIASES);

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function lookupState(s: string): string | null {
  const k = norm(s);
  const hit = stateLookup.get(k);
  if (hit) return hit;
  // Typo tolerance for longer names only ("Maharahstra", "Karanataka"): unique closest within distance 2.
  if (k.length < 7) return null;
  let best: string | null = null;
  let bestD = 3;
  let tie = false;
  for (const [alias, canon] of stateLookup) {
    if (alias.length < 7 || Math.abs(alias.length - k.length) > 2) continue;
    const d = lev(k, alias);
    if (d < bestD) { bestD = d; best = canon; tie = false; }
    else if (d === bestD && best !== canon) tie = true;
  }
  return best && !tie ? best : null;
}

/** state -> cities. A city entry may be "Canonical|alias|alias". */
const CITIES_BY_STATE: Record<string, string> = {
  "Andhra Pradesh":
    "Visakhapatnam|Vizag|Vishakhapatnam|Vishakapatnam,Vijayawada|Bezawada,Guntur,Nellore,Tirupati|Tirupathi,Kurnool,Rajahmundry|Rajamahendravaram,Kakinada,Anantapur|Anantapuram,Kadapa|Cuddapah,Srikakulam,Eluru,Ongole,Machilipatnam,Chittoor,Vizianagaram,Amaravati,Bhimavaram,Tenali",
  Assam: "Guwahati|Gauhati,Dibrugarh,Silchar,Jorhat,Nagaon,Tezpur,Tinsukia,Bongaigaon,Dhubri,Sivasagar",
  Bihar: "Patna,Gaya,Bhagalpur,Muzaffarpur,Purnia,Darbhanga,Arrah|Ara,Begusarai,Banka,Katihar,Munger,Chapra,Sasaram,Hajipur,Bihar Sharif",
  Chhattisgarh: "Raipur,Bilaspur,Bhilai,Durg,Korba,Ambikapur,Raigarh,Jagdalpur,Rajnandgaon",
  Goa: "Panaji|Panjim,Margao|Madgaon,Vasco da Gama|Vasco,Mapusa,Ponda,Calangute",
  Gujarat: "Ahmedabad|Amdavad,Surat,Vadodara|Baroda,Rajkot,Bhavnagar,Jamnagar,Gandhinagar,Junagadh,Anand,Nadiad,Morbi,Bharuch,Navsari,Mehsana,Vapi,Gandhidham,Porbandar",
  Haryana: "Gurugram|Gurgaon,Faridabad,Panipat,Ambala,Karnal,Hisar,Rohtak,Sonipat|Sonepat,Yamunanagar,Panchkula,Bhiwani,Sirsa,Kurukshetra,Jind,Rewari",
  "Himachal Pradesh": "Shimla|Simla,Dharamshala|Dharamsala,Solan,Manali,Mandi,Kullu,Baddi,Una,Hamirpur",
  Jharkhand: "Ranchi,Jamshedpur,Dhanbad,Bokaro|Bokaro Steel City,Hazaribagh,Deoghar,Giridih",
  Karnataka:
    "Bengaluru|Bangalore|Bangaluru|Bengalore|Bengaluru Urban,Mysuru|Mysore,Mangaluru|Mangalore,Hubballi|Hubli|Hubli Dharwad,Dharwad,Belagavi|Belgaum,Kalaburagi|Gulbarga,Ballari|Bellary,Vijayapura|Bijapur,Shivamogga|Shimoga,Davanagere|Davangere,Tumakuru|Tumkur,Udupi,Hassan,Haveri,Sandur,Mandya,Raichur,Bidar,Chitradurga,Chikkamagaluru|Chikmagalur,Kolar,Bagalkot,Gadag,Karwar,Madikeri|Coorg",
  Kerala:
    "Thiruvananthapuram|Trivandrum,Kochi|Cochin|Ernakulam,Kozhikode|Calicut,Thrissur|Trichur,Kollam|Quilon,Alappuzha|Alleppey,Kannur|Cannanore,Kottayam,Palakkad|Palghat,Malappuram,Kasaragod,Pathanamthitta,Idukki,Wayanad,Muvattupuzha,Thodupuzha",
  "Madhya Pradesh": "Bhopal,Indore,Jabalpur,Gwalior,Ujjain,Sagar|Saugor,Satna,Rewa,Dewas,Ratlam,Burhanpur,Khandwa,Chhindwara,Katni,Singrauli,Morena,Vidisha,Neemuch",
  Maharashtra:
    "Mumbai|Bombay,Navi Mumbai,Thane,Pune|Poona,Pimpri Chinchwad|Pimpri-Chinchwad|Pimpri,Nagpur,Nashik|Nasik,Aurangabad|Chhatrapati Sambhajinagar|Sambhajinagar,Solapur,Kolhapur,Amravati,Nanded,Sangli,Jalgaon,Akola,Latur,Dhule,Ahilyanagar|Ahmednagar|Ahiyanagar|Ahmadnagar,Chandrapur,Parbhani,Satara,Wardha,Washim,Ratnagiri,Kalyan,Dombivli,Vasai,Virar,Panvel,Bhiwandi,Mira Road,Malegaon,Baramati,Lonavala,Alibag,Yavatmal,Beed,Osmanabad|Dharashiv,Buldhana,Gondia,Bhandara,Jalna,Hingoli,Ichalkaranji,Karad,Sangamner",
  Manipur: "Imphal",
  Meghalaya: "Shillong,Tura",
  Mizoram: "Aizawl",
  Nagaland: "Kohima,Dimapur",
  Odisha: "Bhubaneswar,Cuttack,Rourkela,Berhampur,Sambalpur,Puri,Balasore|Baleswar,Bhadrak,Jharsuguda,Angul,Koraput,Kendrapara",
  Punjab: "Ludhiana,Amritsar,Jalandhar,Patiala,Bathinda,Mohali|SAS Nagar|Sahibzada Ajit Singh Nagar,Hoshiarpur,Pathankot,Moga,Firozpur|Ferozepur,Kapurthala,Phagwara",
  Rajasthan: "Jaipur,Jodhpur,Udaipur,Kota,Ajmer,Bikaner,Alwar,Bhilwara,Sikar,Sri Ganganagar|Ganganagar,Pali,Hurda,Chittorgarh,Bharatpur,Jhunjhunu,Tonk,Barmer,Mount Abu,Banswara,Nagaur",
  Sikkim: "Gangtok",
  "Tamil Nadu":
    "Chennai|Madras,Coimbatore|Kovai,Madurai,Tiruchirappalli|Trichy|Tiruchi|Tiruchirapalli,Salem,Tirunelveli|Nellai,Tiruppur|Tirupur,Erode,Vellore,Thoothukudi|Tuticorin,Thanjavur|Tanjore,Dindigul,Hosur,Kanyakumari,Nagercoil,Karur,Cuddalore,Kancheepuram|Kanchipuram,Chengalpattu|Chengalpet,Pudukkottai,Thiruvarur,Virudhunagar,Tirupattur|Tirupathur,Namakkal,Kumbakonam,Sivakasi,Ooty|Udhagamandalam|Udagamandalam,Theni,Ramanathapuram,Ariyalur,Perambalur,Nagapattinam,Krishnagiri,Dharmapuri,Villupuram|Viluppuram,Tiruvannamalai,Tenkasi,Ranipet,Tiruvallur|Thiruvallur,Mayiladuthurai,Karaikudi,Sivaganga,Pollachi,Avadi,Tambaram,Ambattur",
  Telangana: "Hyderabad|Secunderabad,Warangal|Hanamkonda,Nizamabad,Karimnagar,Khammam,Mahbubnagar,Nalgonda,Adilabad,Siddipet,Medchal,Suryapet",
  Tripura: "Agartala,Udaipur Tripura",
  "Uttar Pradesh": "Lucknow,Kanpur,Varanasi|Benares|Banaras,Agra,Prayagraj|Allahabad,Ghaziabad,Noida|Greater Noida,Meerut,Bareilly,Aligarh,Moradabad,Gorakhpur,Saharanpur,Jhansi,Mathura,Firozabad,Muzaffarnagar,Ayodhya|Faizabad,Raebareli,Etawah,Mirzapur,Sultanpur",
  Uttarakhand: "Dehradun,Haridwar,Rishikesh,Roorkee,Haldwani,Rudrapur,Nainital,Kashipur,Mussoorie,Almora",
  "West Bengal": "Kolkata|Calcutta,Howrah,Durgapur,Asansol,Siliguri,Kharagpur,Bardhaman|Burdwan,Santiniketan|Shantiniketan,Jalpaiguri,Birbhum,Darjeeling,Malda,Cooch Behar,Bankura,Haldia,Krishnanagar,Barasat,Salt Lake,Baharampur,Purulia",
  "Jammu and Kashmir": "Jammu,Srinagar,Anantnag,Baramulla",
  Ladakh: "Leh,Kargil",
  Delhi: "Delhi|New Delhi|Dilli",
  Chandigarh: "Chandigarh",
  Puducherry: "Puducherry|Pondicherry|Pondy,Karaikal",
  "Andaman and Nicobar Islands": "Port Blair",
  "Dadra and Nagar Haveli and Daman and Diu": "Silvassa",
};

export interface CityInfo {
  canonical: string;
  state: string;
}

const cityLookup = new Map<string, CityInfo>();
for (const [state, list] of Object.entries(CITIES_BY_STATE)) {
  for (const entry of list.split(",")) {
    const [canonical, ...aliases] = entry.split("|");
    for (const name of [canonical, ...aliases]) {
      const k = norm(name);
      // first registration wins (ambiguous names keep their most common state)
      if (!cityLookup.has(k)) cityLookup.set(k, { canonical, state });
    }
  }
}
// "Udaipur" alone is Rajasthan (registered first); Tripura's is spelled out.
cityLookup.set(norm("Udaipur Tripura"), { canonical: "Udaipur", state: "Tripura" });

export function lookupCity(s: string): CityInfo | null {
  return cityLookup.get(norm(s)) ?? null;
}

export const CITY_COUNT = new Set([...cityLookup.values()].map((c) => c.canonical + "|" + c.state)).size;
