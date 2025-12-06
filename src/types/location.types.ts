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

export type NigerianState = typeof NIGERIAN_STATES[number];

export interface UserLocation {
  state: NigerianState;
  city?: string;
  area?: string;
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
  radius_km?: number;
  remote_ok?: boolean;
}