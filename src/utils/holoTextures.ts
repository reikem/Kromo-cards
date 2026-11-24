import type { TextureEffect } from '../types/kromacard';

export interface HoloTexturePreset {
  id: TextureEffect;
  label: string;
  subtitle: string;
  category: 'clasico' | 'festivo';
  imageUrl: string;
}

export const HOLO_TEXTURE_COLLECTION: HoloTexturePreset[] = [
  {
    id: 'holo-prism-shards',
    label: 'Prisma Cristal',
    subtitle: 'Refracción geométrica 3D',
    category: 'clasico',
    imageUrl: '/src/assets/images/holo_prism_shards_1795356018697.jpg',
  },
  {
    id: 'holo-cosmos-galaxy',
    label: 'Cosmos Galaxia',
    subtitle: 'Órbitas y polvo estelar',
    category: 'clasico',
    imageUrl: '/src/assets/images/holo_cosmos_galaxy_1795356018724.jpg',
  },
  {
    id: 'holo-cracked-ice',
    label: 'Hielo Fracturado',
    subtitle: 'Mosaico refractor',
    category: 'clasico',
    imageUrl: '/src/assets/images/holo_cracked_ice_1795356018701.jpg',
  },
  {
    id: 'holo-gold-filigree',
    label: 'Oro Guilloché',
    subtitle: 'Lámina radial dorada',
    category: 'clasico',
    imageUrl: '/src/assets/images/holo_gold_filigree_1795356018771.jpg',
  },
  {
    id: 'holo-laser-confetti',
    label: 'Confeti Láser',
    subtitle: 'Destellos de estadio',
    category: 'clasico',
    imageUrl: '/src/assets/images/holo_laser_confetti_1795356018358.jpg',
  },
  {
    id: 'holo-party-fiesta',
    label: 'Fiesta & Disco',
    subtitle: 'Serpentinas y confeti',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_party_fiesta_1795356578869.jpg',
  },
  {
    id: 'holo-halloween-spooky',
    label: 'Halloween',
    subtitle: 'Calabazas, lunas y neón',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_halloween_spooky_1795356579915.jpg',
  },
  {
    id: 'holo-christmas-festive',
    label: 'Navidad',
    subtitle: 'Copos dorados y rubí',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_christmas_festive_1795356581836.jpg',
  },
  {
    id: 'holo-valentines-hearts',
    label: 'San Valentín',
    subtitle: 'Corazones de cristal',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_valentines_hearts_1795356579717.jpg',
  },
  {
    id: 'holo-fireworks-gala',
    label: 'Año Nuevo & Gala',
    subtitle: 'Fuegos artificiales HD',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_fireworks_gala_1795356579735.jpg',
  },
  {
    id: 'holo-winter-frost',
    label: 'Escarcha Invernal',
    subtitle: 'Copos y cristal glacial',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_winter_frost_bg_1795356977171.jpg',
  },
  {
    id: 'holo-winter-aurora',
    label: 'Aurora Boreal',
    subtitle: 'Ondas polares HD',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_winter_aurora_bg_1795356978248.jpg',
  },
  {
    id: 'holo-christmas-ornaments',
    label: 'Navidad Dorada',
    subtitle: 'Acebo y estrellas oro',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_christmas_ornaments_bg_1795356979694.jpg',
  },
  {
    id: 'holo-newyear-champagne',
    label: 'Brindis Año Nuevo',
    subtitle: 'Burbujas y serpentina',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_newyear_champagne_bg_1795356979717.jpg',
  },
  {
    id: 'holo-festive-snowlight',
    label: 'Nieve y Luces',
    subtitle: 'Destellos de invierno',
    category: 'festivo',
    imageUrl: '/src/assets/images/holo_festive_snowlight_bg_1795356979884.jpg',
  },
];

export function getHoloTextureOverlayUrl(texture: TextureEffect): string | null {
  const found = HOLO_TEXTURE_COLLECTION.find((item) => item.id === texture);
  return found ? found.imageUrl : null;
}
