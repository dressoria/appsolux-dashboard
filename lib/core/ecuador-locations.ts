export type EcuadorCanton = { name: string; parishes: readonly string[] };
export type EcuadorProvince = {
  name: string;
  cantons: readonly EcuadorCanton[];
};

// Catálogo administrativo reutilizable. Puede ampliarse sin modificar formularios.
export const ECUADOR_LOCATIONS: readonly EcuadorProvince[] = [
  {
    name: "Azuay",
    cantons: [
      { name: "Cuenca", parishes: ["Cuenca", "Baños", "Sayausí", "Turi"] },
      { name: "Gualaceo", parishes: ["Gualaceo"] },
    ],
  },
  {
    name: "Bolívar",
    cantons: [
      { name: "Guaranda", parishes: ["Guaranda"] },
      { name: "San Miguel", parishes: ["San Miguel"] },
    ],
  },
  {
    name: "Cañar",
    cantons: [
      { name: "Azogues", parishes: ["Azogues"] },
      { name: "Cañar", parishes: ["Cañar"] },
    ],
  },
  {
    name: "Carchi",
    cantons: [
      { name: "Tulcán", parishes: ["Tulcán"] },
      { name: "Montúfar", parishes: ["San Gabriel"] },
    ],
  },
  {
    name: "Chimborazo",
    cantons: [
      { name: "Riobamba", parishes: ["Riobamba", "Licán"] },
      { name: "Guano", parishes: ["Guano"] },
    ],
  },
  {
    name: "Cotopaxi",
    cantons: [
      { name: "Latacunga", parishes: ["Latacunga"] },
      { name: "La Maná", parishes: ["La Maná"] },
    ],
  },
  {
    name: "El Oro",
    cantons: [
      { name: "Machala", parishes: ["Machala"] },
      { name: "Pasaje", parishes: ["Pasaje"] },
      { name: "Santa Rosa", parishes: ["Santa Rosa"] },
    ],
  },
  {
    name: "Esmeraldas",
    cantons: [
      { name: "Esmeraldas", parishes: ["Esmeraldas"] },
      { name: "Atacames", parishes: ["Atacames"] },
    ],
  },
  {
    name: "Galápagos",
    cantons: [
      { name: "San Cristóbal", parishes: ["Puerto Baquerizo Moreno"] },
      { name: "Santa Cruz", parishes: ["Puerto Ayora"] },
    ],
  },
  {
    name: "Guayas",
    cantons: [
      {
        name: "Guayaquil",
        parishes: ["Ayacucho", "Febres Cordero", "Tarqui", "Ximena"],
      },
      { name: "Durán", parishes: ["Eloy Alfaro"] },
      { name: "Samborondón", parishes: ["Samborondón", "La Puntilla"] },
    ],
  },
  {
    name: "Imbabura",
    cantons: [
      { name: "Ibarra", parishes: ["Ibarra"] },
      { name: "Otavalo", parishes: ["Otavalo"] },
    ],
  },
  {
    name: "Loja",
    cantons: [
      { name: "Loja", parishes: ["Loja", "Vilcabamba"] },
      { name: "Catamayo", parishes: ["Catamayo"] },
    ],
  },
  {
    name: "Los Ríos",
    cantons: [
      { name: "Babahoyo", parishes: ["Babahoyo"] },
      { name: "Quevedo", parishes: ["Quevedo"] },
    ],
  },
  {
    name: "Manabí",
    cantons: [
      { name: "Portoviejo", parishes: ["Portoviejo"] },
      { name: "Manta", parishes: ["Manta", "Tarqui"] },
      { name: "Chone", parishes: ["Chone"] },
    ],
  },
  {
    name: "Morona Santiago",
    cantons: [
      { name: "Morona", parishes: ["Macas"] },
      { name: "Gualaquiza", parishes: ["Gualaquiza"] },
    ],
  },
  {
    name: "Napo",
    cantons: [
      { name: "Tena", parishes: ["Tena"] },
      { name: "Archidona", parishes: ["Archidona"] },
    ],
  },
  {
    name: "Orellana",
    cantons: [
      {
        name: "Francisco de Orellana",
        parishes: ["Puerto Francisco de Orellana"],
      },
    ],
  },
  { name: "Pastaza", cantons: [{ name: "Pastaza", parishes: ["Puyo"] }] },
  {
    name: "Pichincha",
    cantons: [
      { name: "Quito", parishes: ["Quito", "Cumbayá", "Tumbaco", "Calderón"] },
      { name: "Rumiñahui", parishes: ["Sangolquí"] },
      { name: "Cayambe", parishes: ["Cayambe"] },
    ],
  },
  {
    name: "Santa Elena",
    cantons: [
      { name: "Santa Elena", parishes: ["Santa Elena"] },
      { name: "Salinas", parishes: ["Salinas"] },
      { name: "La Libertad", parishes: ["La Libertad"] },
    ],
  },
  {
    name: "Santo Domingo de los Tsáchilas",
    cantons: [{ name: "Santo Domingo", parishes: ["Santo Domingo"] }],
  },
  {
    name: "Sucumbíos",
    cantons: [{ name: "Lago Agrio", parishes: ["Nueva Loja"] }],
  },
  {
    name: "Tungurahua",
    cantons: [
      { name: "Ambato", parishes: ["Ambato"] },
      { name: "Baños de Agua Santa", parishes: ["Baños"] },
    ],
  },
  {
    name: "Zamora Chinchipe",
    cantons: [
      { name: "Zamora", parishes: ["Zamora"] },
      { name: "Yantzaza", parishes: ["Yantzaza"] },
    ],
  },
] as const;

export function getEcuadorCantons(province: string) {
  return (
    ECUADOR_LOCATIONS.find((item) => item.name === province)?.cantons ?? []
  );
}

export function getEcuadorParishes(province: string, canton: string) {
  return (
    getEcuadorCantons(province).find((item) => item.name === canton)
      ?.parishes ?? []
  );
}
