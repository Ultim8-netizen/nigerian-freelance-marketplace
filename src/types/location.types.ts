// src/types/location.types.ts
// Nigerian states and major cities

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo',
  'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna',
  'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
] as const;

export const MAJOR_CITIES: Record<string, string[]> = {
  'Lagos': ['Ikeja', 'Victoria Island', 'Lekki', 'Surulere', 'Yaba', 'Ikorodu', 'Ajah', 'Festac'],
  'FCT': ['Abuja', 'Gwagwalada', 'Kubwa', 'Lugbe', 'Maitama', 'Wuse', 'Gwarinpa'],
  'Kano': ['Kano City', 'Nassarawa', 'Fagge', 'Dala'],
  'Rivers': ['Port Harcourt', 'Obio-Akpor', 'Eleme'],
  'Oyo': ['Ibadan', 'Ogbomosho', 'Oyo'],
  'Kaduna': ['Kaduna City', 'Zaria', 'Kafanchan'],
  'Ogun': ['Abeokuta', 'Ijebu-Ode', 'Sagamu'],
  'Anambra': ['Awka', 'Onitsha', 'Nnewi'],
  'Enugu': ['Enugu City', 'Nsukka', 'Agbani'],
  'Delta': ['Asaba', 'Warri', 'Sapele'],
  'Edo': ['Benin City', 'Auchi'],
  'Plateau': ['Jos', 'Bukuru'],
  'Imo': ['Owerri', 'Orlu'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene'],
};

// Nigerian Universities
export const NIGERIAN_UNIVERSITIES = [
  // Federal Universities
  { name: 'University of Lagos (UNILAG)', state: 'Lagos', type: 'Federal' },
  { name: 'University of Ibadan (UI)', state: 'Oyo', type: 'Federal' },
  { name: 'Obafemi Awolowo University (OAU)', state: 'Osun', type: 'Federal' },
  { name: 'University of Nigeria, Nsukka (UNN)', state: 'Enugu', type: 'Federal' },
  { name: 'Ahmadu Bello University (ABU)', state: 'Kaduna', type: 'Federal' },
  { name: 'University of Benin (UNIBEN)', state: 'Edo', type: 'Federal' },
  { name: 'University of Ilorin (UNILORIN)', state: 'Kwara', type: 'Federal' },
  { name: 'University of Jos', state: 'Plateau', type: 'Federal' },
  { name: 'University of Calabar (UNICAL)', state: 'Cross River', type: 'Federal' },
  { name: 'University of Port Harcourt (UNIPORT)', state: 'Rivers', type: 'Federal' },
  { name: 'Bayero University Kano (BUK)', state: 'Kano', type: 'Federal' },
  { name: 'University of Abuja', state: 'FCT', type: 'Federal' },
  { name: 'Federal University of Technology, Akure (FUTA)', state: 'Ondo', type: 'Federal' },
  { name: 'Federal University of Technology, Minna (FUTMINNA)', state: 'Niger', type: 'Federal' },
  { name: 'Federal University of Technology, Owerri (FUTO)', state: 'Imo', type: 'Federal' },
  { name: 'Nnamdi Azikiwe University (UNIZIK)', state: 'Anambra', type: 'Federal' },
  
  // State Universities
  { name: 'Lagos State University (LASU)', state: 'Lagos', type: 'State' },
  { name: 'Ekiti State University (EKSU)', state: 'Ekiti', type: 'State' },
  { name: 'Delta State University (DELSU)', state: 'Delta', type: 'State' },
  { name: 'Ambrose Alli University', state: 'Edo', type: 'State' },
  { name: 'Rivers State University', state: 'Rivers', type: 'State' },
  { name: 'Osun State University (UNIOSUN)', state: 'Osun', type: 'State' },
  { name: 'Adekunle Ajasin University', state: 'Ondo', type: 'State' },
  { name: 'Kaduna State University (KASU)', state: 'Kaduna', type: 'State' },
  
  // Private Universities
  { name: 'Covenant University', state: 'Ogun', type: 'Private' },
  { name: 'Babcock University', state: 'Ogun', type: 'Private' },
  { name: 'Landmark University', state: 'Ogun', type: 'Private' },
  { name: 'Pan-Atlantic University', state: 'Lagos', type: 'Private' },
  { name: 'Bowen University', state: 'Osun', type: 'Private' },
  { name: 'Achievers University', state: 'Ondo', type: 'Private' },
  { name: 'American University of Nigeria (AUN)', state: 'Adamawa', type: 'Private' },
  { name: 'Baze University', state: 'FCT', type: 'Private' },
  { name: 'Lead City University', state: 'Oyo', type: 'Private' },
  
  // Polytechnics & Colleges
  { name: 'Yaba College of Technology (YABATECH)', state: 'Lagos', type: 'Polytechnic' },
  { name: 'Federal Polytechnic Nekede', state: 'Imo', type: 'Polytechnic' },
  { name: 'Kaduna Polytechnic', state: 'Kaduna', type: 'Polytechnic' },
  { name: 'Federal Polytechnic Ilaro', state: 'Ogun', type: 'Polytechnic' },
] as const;

export type NigerianState = typeof NIGERIAN_STATES[number];
export type University = typeof NIGERIAN_UNIVERSITIES[number];
export type UniversityType = 'Federal' | 'State' | 'Private' | 'Polytechnic';

export interface UserLocation {
  state: NigerianState;
  city?: string;
  area?: string;
  university?: string; // University name
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  detection_method: 'manual' | 'browser' | 'ip';
  last_updated: string;
}

export interface LocationFilter {
  state?: NigerianState;
  city?: string;
  university?: string;
  radius_km?: number;
  remote_ok?: boolean;
}

// Helper function to get universities by state
export const getUniversitiesByState = (state: NigerianState): University[] => {
  return NIGERIAN_UNIVERSITIES.filter(uni => uni.state === state);
};

// Helper function to get universities by type
export const getUniversitiesByType = (type: UniversityType): University[] => {
  return NIGERIAN_UNIVERSITIES.filter(uni => uni.type === type);
};

// Helper function to find university by name (partial match)
export const findUniversityByName = (searchTerm: string): University | undefined => {
  const term = searchTerm.toLowerCase();
  return NIGERIAN_UNIVERSITIES.find(uni => 
    uni.name.toLowerCase().includes(term)
  );
};

// Get all university names for autocomplete/dropdown
export const getUniversityNames = (): string[] => {
  return NIGERIAN_UNIVERSITIES.map(uni => uni.name);
};