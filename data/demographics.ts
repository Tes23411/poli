
import { Demographics } from '../types';

function toCamelCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    // "malay (%)" -> "malay percent"
    .replace(new RegExp('\\s*\\(%\\)'), ' percent')
    // "classification (1947)" -> "classification"
    .replace(new RegExp('\\s*\\([^)]*\\)'), '')
    // "malay percent" -> "malayPercent", "unique code" -> "uniqueCode"
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
        if (!key) return; // Skip empty headers that might result from parsing
        const value = values[index] ? values[index].trim() : '';
        const numValue = parseFloat(value);
        entry[key] = isNaN(numValue) || value.trim() === '' ? value : numValue;
      });
      return entry as unknown as Demographics;
    });

    return data;
  } catch (error) {
    console.error("Error parsing demographics CSV:", error);
    return [];
  }
};
