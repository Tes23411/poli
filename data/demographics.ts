import { Demographics } from '../types';

function toCamelCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(new RegExp('\\s*\\(%\\)'), ' percent')
    .replace(new RegExp('\\s*\\([^)]*\\)'), '')
    .replace(new RegExp('[^a-zA-Z0-9]+(.)?', 'g'), (_match, chr) => chr ? chr.toUpperCase() : '');
}

export const loadDemographicsData = async (): Promise<Demographics[]> => {
  try {
    const response = await fetch('./data/demographics.csv');
    if (!response.ok) {
      console.error('Failed to load demographics data');
      return [];
    }
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return [];
    }

    const headerLine = lines.shift()!;
    const headers = headerLine.split(',').map(h => toCamelCase(h.trim()));
    
    const data: Demographics[] = lines.map(line => {
      const values = line.split(',');
      const entry: { [key: string]: string | number } = {};
      
      headers.forEach((key, index) => {
        if (!key) return;
        const value = values[index] ? values[index].trim() : '';
        const numValue = parseFloat(value);
        entry[key] = isNaN(numValue) || value.trim() === '' ? value : numValue;
      });

      // --- NEW LOGIC START ---
      // Separate Others into specific native groups based on State
      let others = (entry['othersPercent'] as number) || 0;
      let northBornean = 0;
      let sarawakNative = 0;

      const state = (entry['state'] as string)?.toUpperCase();

      if (state === 'SABAH') {
          northBornean = others;
          others = 0; // Assuming largely native, or you can keep a small residual percentage for actual 'others'
      } else if (state === 'SARAWAK') {
          sarawakNative = others;
          others = 0;
      }

      // Assign back to entry
      entry['othersPercent'] = others;
      entry['northBorneanNativesPercent'] = northBornean;
      entry['sarawakNativesPercent'] = sarawakNative;
      // --- NEW LOGIC END ---

      return entry as unknown as Demographics;
    });

    return data;
  } catch (error) {
    console.error("Error parsing demographics CSV:", error);
    return [];
  }
};