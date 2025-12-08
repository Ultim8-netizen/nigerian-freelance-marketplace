// src/types/marketplace-categories.ts
export const MARKETPLACE_CATEGORIES = {
  FASHION: {
    label: 'Fashion & Accessories',
    options: ['Clothes', 'Shoes', 'Bags', 'Jewelry', 'Watches'],
  },
  ELECTRONICS: {
    label: 'Electronics',
    options: ['Phones', 'Laptops', 'Chargers', 'Headphones', 'Accessories'],
  },
  FOOD: {
    label: 'Food & Snacks',
    options: ['Cooked Food', 'Snacks', 'Drinks', 'Fruits'],
  },
  BOOKS: {
    label: 'Books & Academic',
    options: ['Textbooks', 'Notes', 'Stationery', 'Past Questions'],
  },
  // ... more categories
} as const;