/** Approximate coordinates (lat, lng) for the places AICF events are held in. Hand-kept, deliberately small. */
type LatLng = readonly [number, number];

/** A representative point per state / UT (the main chess city or a rough centroid). */
export const STATE_POINTS: Record<string, LatLng> = {
  "Andaman and Nicobar Islands": [11.62, 92.73],
  "Andhra Pradesh": [16.0, 80.2],
  "Arunachal Pradesh": [27.6, 94.0],
  Assam: [26.3, 92.6],
  Bihar: [25.6, 85.6],
  Chandigarh: [30.73, 76.78],
  Chhattisgarh: [21.4, 81.8],
  "Dadra and Nagar Haveli and Daman and Diu": [20.4, 72.9],
  Delhi: [28.63, 77.22],
  Goa: [15.4, 74.0],
  Gujarat: [22.6, 72.4],
  Haryana: [29.1, 76.3],
  "Himachal Pradesh": [31.8, 77.2],
  "Jammu and Kashmir": [33.6, 75.0],
  Jharkhand: [23.6, 85.4],
  Karnataka: [14.8, 76.0],
  Kerala: [10.2, 76.4],
  Ladakh: [34.2, 77.6],
  Lakshadweep: [10.57, 72.64],
  "Madhya Pradesh": [23.4, 78.1],
  Maharashtra: [19.4, 75.6],
  Manipur: [24.7, 93.9],
  Meghalaya: [25.5, 91.4],
  Mizoram: [23.4, 92.8],
  Nagaland: [26.1, 94.4],
  Odisha: [20.4, 84.6],
  Puducherry: [11.93, 79.83],
  Punjab: [30.9, 75.6],
  Rajasthan: [26.6, 73.9],
  Sikkim: [27.5, 88.5],
  "Tamil Nadu": [11.0, 78.4],
  Telangana: [17.6, 79.0],
  Tripura: [23.8, 91.5],
  "Uttar Pradesh": [26.9, 80.9],
  Uttarakhand: [30.1, 78.9],
  "West Bengal": [23.2, 87.9],
};

export const CITY_POINTS: Record<string, LatLng> = {
  Agra: [27.18, 78.01], Ahilyanagar: [19.09, 74.74], Ahmedabad: [23.02, 72.57], Ahmednagar: [19.09, 74.74], Ajmer: [26.45, 74.64],
  Aligarh: [27.88, 78.08], Ambikapur: [23.12, 83.2], Amravati: [20.93, 77.75], Amritsar: [31.63, 74.87], Aurangabad: [19.88, 75.34],
  Banka: [24.88, 86.92], Belagavi: [15.85, 74.5], Bengaluru: [12.97, 77.59], Bhagalpur: [25.24, 86.97], Bhilai: [21.21, 81.38],
  Bhilwara: [25.35, 74.63], Bhopal: [23.26, 77.41], Bhubaneswar: [20.3, 85.82], Bikaner: [28.02, 73.31], Birbhum: [23.9, 87.53],
  Chandigarh: [30.73, 76.78], Chengalpattu: [12.69, 79.98], Chennai: [13.08, 80.27], Coimbatore: [11.02, 76.96], Cuddalore: [11.75, 79.75],
  Cuttack: [20.46, 85.88], Davanagere: [14.46, 75.92], Dehradun: [30.32, 78.03], Delhi: [28.63, 77.22], "New Delhi": [28.61, 77.21],
  Dhanbad: [23.8, 86.43], Dibrugarh: [27.47, 94.91], Durgapur: [23.52, 87.31], Erode: [11.34, 77.72], Faridabad: [28.41, 77.32],
  Gandhinagar: [23.22, 72.65], Ghaziabad: [28.67, 77.45], Gurugram: [28.46, 77.03], Guwahati: [26.14, 91.74], Gwalior: [26.22, 78.18],
  Haveri: [14.79, 75.4], Hubballi: [15.36, 75.12], Hurda: [25.23, 74.47], Hyderabad: [17.39, 78.49], Imphal: [24.82, 93.94],
  Indore: [22.72, 75.86], Jabalpur: [23.18, 79.99], Jaipur: [26.91, 75.79], Jalandhar: [31.33, 75.58], Jalgaon: [21.0, 75.56],
  Jalpaiguri: [26.52, 88.72], Jammu: [32.73, 74.86], Jamshedpur: [22.8, 86.2], Jodhpur: [26.24, 73.02], Kanpur: [26.45, 80.33],
  Kanyakumari: [8.09, 77.54], Karaikudi: [10.07, 78.78], Kochi: [9.93, 76.27], Kohima: [25.67, 94.11], Kolhapur: [16.7, 74.24],
  Kolkata: [22.57, 88.36], Kota: [25.18, 75.83], Kottayam: [9.59, 76.52], Kozhikode: [11.26, 75.78], Lucknow: [26.85, 80.95],
  Ludhiana: [30.9, 75.86], Madurai: [9.93, 78.12], Mangaluru: [12.91, 74.86], Margao: [15.28, 73.96], Meerut: [28.98, 77.71],
  Mumbai: [19.08, 72.88], Mysuru: [12.3, 76.64], Nagercoil: [8.18, 77.41], Nagpur: [21.15, 79.09], Nashik: [20.0, 73.79],
  "Navi Mumbai": [19.03, 73.03], Noida: [28.54, 77.39], Panaji: [15.49, 73.83], Patna: [25.59, 85.14], Puducherry: [11.93, 79.83],
  Pudukkottai: [10.38, 78.82], Pune: [18.52, 73.86], Raipur: [21.25, 81.63], Rajkot: [22.3, 70.8], Ranchi: [23.34, 85.31],
  Rudrapur: [28.98, 79.4], Sagar: [23.84, 78.74], Salem: [11.66, 78.15], Sandur: [15.08, 76.55], Santiniketan: [23.68, 87.68],
  Shillong: [25.58, 91.89], Shivamogga: [13.93, 75.57], Siliguri: [26.73, 88.4], Solapur: [17.66, 75.91], Sonipat: [28.99, 77.02],
  Srikakulam: [18.3, 83.9], Surat: [21.17, 72.83], Thane: [19.22, 72.98], Thanjavur: [10.79, 79.14], Thiruvananthapuram: [8.52, 76.94],
  Thiruvarur: [10.77, 79.64], Thrissur: [10.53, 76.21], Tiruchirappalli: [10.8, 78.69], Tirunelveli: [8.71, 77.76], Tirupati: [13.63, 79.42],
  Tirupattur: [12.5, 78.57], Tiruppur: [11.11, 77.34], Udaipur: [24.59, 73.71], Vadodara: [22.31, 73.18], Varanasi: [25.32, 82.97],
  Vellore: [12.92, 79.13], Vijayawada: [16.51, 80.65], Virudhunagar: [9.58, 77.96], Visakhapatnam: [17.69, 83.22], Wardha: [20.74, 78.6],
  Warangal: [17.97, 79.59], Washim: [20.11, 77.13], Agartala: [23.83, 91.29], Aizawl: [23.73, 92.72], Itanagar: [27.08, 93.61],
};

/** Best-known point for an event's place: its city, else its state, else nothing. */
export function placePoint(city: string | null, state: string | null): LatLng | null {
  return (city && CITY_POINTS[city]) || (state && STATE_POINTS[state]) || null;
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type { LatLng };
