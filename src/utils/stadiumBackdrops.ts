export interface StadiumBackdropPreset {
  id: string;
  label: string;
  atmosphere: string;
  imageUrl: string;
}

export const STADIUM_BACKDROPS: StadiumBackdropPreset[] = [
  {
    id: 'blue-lasers',
    label: 'Láser Cian',
    atmosphere: 'Haces azules y pulseras LED',
    imageUrl: '/src/assets/images/stadium_blue_lasers_1795356119795.jpg',
  },
  {
    id: 'magenta-encore',
    label: 'Encore Magenta',
    atmosphere: 'Niebla violeta y confeti vivo',
    imageUrl: '/src/assets/images/stadium_magenta_encore_1795356119636.jpg',
  },
  {
    id: 'golden-pyro',
    label: 'Pirotecnia Oro',
    atmosphere: 'Rayos dorados y gran final',
    imageUrl: '/src/assets/images/stadium_golden_pyro_1795356122266.jpg',
  },
  {
    id: 'neon-rain',
    label: 'Domo Neón',
    atmosphere: 'Reflejos turquesa y lluvia',
    imageUrl: '/src/assets/images/stadium_neon_rain_1795356121959.jpg',
  },
  {
    id: 'sunset-festival',
    label: 'Atardecer Tour',
    atmosphere: 'Ocaso rosado y focos cobalto',
    imageUrl: '/src/assets/images/stadium_sunset_festival_1795356122086.jpg',
  },
];
