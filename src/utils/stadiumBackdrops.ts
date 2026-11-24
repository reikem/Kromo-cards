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
  {
    id: 'cyberpunk-arcade',
    label: 'Cyberpunk Neón',
    atmosphere: 'Rejilla cian, lluvia y neón nocturno',
    imageUrl: '/src/assets/images/backdrop_cyberpunk_neon_1795556031098.jpg',
  },
  {
    id: 'sakura-night',
    label: 'Cielo Sakura',
    atmosphere: 'Pétalos de cerezo bajo luna creciente',
    imageUrl: '/src/assets/images/backdrop_sakura_night_1795556030949.jpg',
  },
  {
    id: 'solar-eclipse',
    label: 'Eclipse Dorado',
    atmosphere: 'Corona solar ámbar y polvo estelar',
    imageUrl: '/src/assets/images/backdrop_solar_eclipse_1795556031893.jpg',
  },
  {
    id: 'crystal-cavern',
    label: 'Caverna Cristal',
    atmosphere: 'Amatista, esmeralda y destellos prisma',
    imageUrl: '/src/assets/images/backdrop_crystal_cavern_1795556031959.jpg',
  },
  {
    id: 'winter-aurora',
    label: 'Aurora Boreal',
    atmosphere: 'Cortinas polares verde y violeta',
    imageUrl: '/src/assets/images/holo_winter_aurora_bg_1795356978248.jpg',
  },
  {
    id: 'cosmos-galaxy',
    label: 'Galaxia Profunda',
    atmosphere: 'Nebulosa cósmica y estrellas',
    imageUrl: '/src/assets/images/holo_cosmos_galaxy_1795356018724.jpg',
  },
  {
    id: 'fireworks-gala',
    label: 'Gala Pirotecnia',
    atmosphere: 'Fuegos artificiales de celebración',
    imageUrl: '/src/assets/images/holo_fireworks_gala_1795356579735.jpg',
  },
  {
    id: 'champagne-newyear',
    label: 'Año Nuevo Dorado',
    atmosphere: 'Burbujas doradas y luces festivas',
    imageUrl: '/src/assets/images/holo_newyear_champagne_bg_1795356979717.jpg',
  },
];
