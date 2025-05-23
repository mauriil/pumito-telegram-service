export interface Pack {
  id: string;
  name: string;
  price: number;
  credits: number;
  description: string;
}

export const PACKS: Pack[] = [
  {
    id: 'p1',
    name: 'Pack Básico',
    price: 5,
    credits: 50,
    description: 'Perfecto para empezar'
  },
  {
    id: 'p2',
    name: 'Pack Estándar',
    price: 10,
    credits: 120,
    description: 'La opción más popular'
  },
  {
    id: 'p3',
    name: 'Pack Premium',
    price: 20,
    credits: 300,
    description: 'La mejor relación precio/créditos'
  },
  {
    id: 'p4',
    name: 'Pack Pro',
    price: 50,
    credits: 1000,
    description: 'Para usuarios avanzados'
  }
]; 