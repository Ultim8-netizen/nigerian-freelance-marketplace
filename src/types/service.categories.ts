// src/types/service.categories.ts
// Service categories tailored for Nigerian university students

export const SERVICE_CATEGORIES = {
  // Academic Services
  ACADEMIC: {
    label: 'Academic Services',
    options: [
      'Assignment Help',
      'Project Writing',
      'Thesis/Dissertation',
      'Proofreading & Editing',
      'Research Assistance',
      'Presentation Design',
      'Tutoring',
      'Study Notes',
      'Essay Writing',
      'Data Analysis (SPSS, Excel)',
    ],
  },

  // Tech & Digital
  TECH: {
    label: 'Tech & Digital',
    options: [
      'Website Development',
      'Mobile App Development',
      'Graphic Design',
      'Video Editing',
      'Social Media Management',
      'Logo Design',
      'UI/UX Design',
      'Photography',
      'Content Creation',
      'Digital Marketing',
    ],
  },

  // Creative Services
  CREATIVE: {
    label: 'Creative Services',
    options: [
      'Voiceover & MC',
      'Music Production',
      'Beat Making',
      'Poetry Writing',
      'Song Writing',
      'Fashion Design',
      'Makeup Artistry',
      'Hairstyling',
      'Event Photography',
      'Video Coverage',
    ],
  },

  // Personal Services
  PERSONAL: {
    label: 'Personal Services',
    options: [
      'Laundry Services',
      'Meal Prep/Cooking',
      'Room Cleaning',
      'Shopping Assistant',
      'Errand Running',
      'Moving Help',
      'Fitness Training',
      'Hair Braiding',
      'Makeup Services',
      'Delivery Services',
    ],
  },

  // Business & Professional
  BUSINESS: {
    label: 'Business & Professional',
    options: [
      'Business Plan Writing',
      'CV/Resume Writing',
      'Cover Letter Writing',
      'LinkedIn Profile Setup',
      'Virtual Assistant',
      'Data Entry',
      'Transcription',
      'Translation Services',
      'Legal Document Drafting',
      'Financial Planning',
    ],
  },

  // Skills & Lessons
  SKILLS: {
    label: 'Skills & Lessons',
    options: [
      'Language Lessons',
      'Coding Lessons',
      'Music Lessons',
      'Dance Lessons',
      'Cooking Lessons',
      'Makeup Lessons',
      'Photography Lessons',
      'Public Speaking Coach',
      'Career Coaching',
      'Life Coaching',
    ],
  },

  // Entertainment & Events
  ENTERTAINMENT: {
    label: 'Entertainment & Events',
    options: [
      'DJ Services',
      'Event Planning',
      'Party Decoration',
      'Catering Services',
      'Cake Making',
      'Small Chops',
      'Hype Man/MC',
      'Stand-up Comedy',
      'Dance Performance',
      'Live Music Performance',
    ],
  },

  // Custom/Other
  OTHER: {
    label: 'Other Services',
    options: [
      'Custom Service (Specify)',
    ],
  },
} as const;

// Flatten all categories for easy access
export const ALL_SERVICE_OPTIONS = Object.values(SERVICE_CATEGORIES).flatMap(
  (category) => category.options
);

/**
 * Helper to get the category label based on a specific service option.
 * * @param service The service option string to look up.
 * @returns The label of the category the service belongs to.
 */
export function getCategoryByService(service: string): string {
  // Renamed 'key' to '_key' to resolve the ESLint warning about unused variables.
  for (const [_key, category] of Object.entries(SERVICE_CATEGORIES)) {
    // The type assertion 'as readonly string[]' is used here to resolve 
    // TypeScript error TS2345. It tells TypeScript that although the array 
    // elements are strict literals due to 'as const', it is safe to check 
    // against a generic 'string' type using 'includes'.
    if ((category.options as readonly string[]).includes(service)) {
      return category.label;
    }
  }
  return SERVICE_CATEGORIES.OTHER.label;
}