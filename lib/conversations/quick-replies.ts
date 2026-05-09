export type QuickReply = {
  id: string;
  category: string;
  title: string;
  shortcut: string;
  text: string;
};

export const QUICK_REPLIES: QuickReply[] = [
  // Pagos
  {
    id: "pago-metodos",
    category: "Pagos",
    title: "Métodos de pago",
    shortcut: "pago",
    text: "Puedes realizar tu pago por transferencia o depósito. Envíanos el comprobante por este chat para validar tu pedido.",
  },
  {
    id: "pago-comprobante",
    category: "Pagos",
    title: "Enviar comprobante",
    shortcut: "comprobante",
    text: "Por favor envíanos una foto clara del comprobante para validar tu pago.",
  },
  {
    id: "pago-recibido",
    category: "Pagos",
    title: "Pago recibido",
    shortcut: "pagook",
    text: "Pago recibido, muchas gracias. Vamos a continuar con la preparación de tu pedido.",
  },
  {
    id: "pago-pendiente",
    category: "Pagos",
    title: "Pago pendiente",
    shortcut: "pagopendiente",
    text: "Tu pedido queda pendiente hasta recibir la confirmación del pago.",
  },
  // Envíos
  {
    id: "envio-costo",
    category: "Envíos",
    title: "Costo de envío",
    shortcut: "envio",
    text: "Indícanos tu ciudad y sector para confirmarte el costo de envío.",
  },
  {
    id: "envio-gratis",
    category: "Envíos",
    title: "Envío gratis",
    shortcut: "enviogratis",
    text: "Este pedido aplica con envío gratis. Confírmanos tus datos para coordinar la entrega.",
  },
  {
    id: "envio-despacho",
    category: "Envíos",
    title: "Pedido despachado",
    shortcut: "despacho",
    text: "Tu pedido ya fue despachado. Te compartiremos la información de entrega apenas esté disponible.",
  },
  {
    id: "envio-datos",
    category: "Envíos",
    title: "Datos para envío",
    shortcut: "datos",
    text: "Por favor envíanos: nombre completo, teléfono, ciudad, dirección exacta y referencia.",
  },
  // Atención
  {
    id: "atencion-horario",
    category: "Atención",
    title: "Horario de atención",
    shortcut: "horario",
    text: "Nuestro horario de atención es de lunes a sábado. Puedes escribirnos por este medio y te ayudaremos lo antes posible.",
  },
  {
    id: "atencion-ubicacion",
    category: "Atención",
    title: "Ubicación",
    shortcut: "ubicacion",
    text: "Indícanos en qué ciudad te encuentras para compartirte la ubicación o punto de entrega más cercano.",
  },
  {
    id: "atencion-gracias",
    category: "Atención",
    title: "Gracias por escribir",
    shortcut: "gracias",
    text: "Gracias por escribirnos. Con gusto te ayudamos.",
  },
  {
    id: "atencion-momento",
    category: "Atención",
    title: "Un momento",
    shortcut: "momento",
    text: "Permítenos un momento por favor, estamos revisando la información para ayudarte correctamente.",
  },
  // Ventas
  {
    id: "ventas-precio",
    category: "Ventas",
    title: "Precio y disponibilidad",
    shortcut: "precio",
    text: "Con gusto. ¿Podrías indicarnos qué producto deseas para confirmarte precio y disponibilidad?",
  },
  {
    id: "ventas-disponible",
    category: "Ventas",
    title: "Producto disponible",
    shortcut: "disponible",
    text: "Sí tenemos disponible. ¿Deseas que te ayudemos a separar tu pedido?",
  },
  {
    id: "ventas-agotado",
    category: "Ventas",
    title: "Producto agotado",
    shortcut: "agotado",
    text: "Por el momento ese producto está agotado. Podemos avisarte cuando vuelva a estar disponible.",
  },
  {
    id: "ventas-confirmar",
    category: "Ventas",
    title: "Confirmar pedido",
    shortcut: "pedido",
    text: "Para confirmar tu pedido, por favor envíanos tus datos de entrega y el comprobante de pago.",
  },
  // Reclamos
  {
    id: "reclamo-revisar",
    category: "Reclamos",
    title: "Revisaremos tu caso",
    shortcut: "reclamo",
    text: "Lamentamos el inconveniente. Vamos a revisar tu caso y te daremos una respuesta lo antes posible.",
  },
  {
    id: "reclamo-disculpa",
    category: "Reclamos",
    title: "Disculpa por el inconveniente",
    shortcut: "disculpa",
    text: "Lamentamos mucho el inconveniente ocasionado. Trabajaremos para resolverlo a la brevedad posible.",
  },
];

export const QUICK_REPLY_CATEGORIES = [
  "Pagos",
  "Envíos",
  "Atención",
  "Ventas",
  "Reclamos",
] as const;

export function applyVariables(text: string, contactName?: string): string {
  return text.replace(/\{cliente\}/g, contactName?.trim() ?? "");
}

export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function findBySlash(input: string): QuickReply[] {
  const match = /(^|[\n ])\/(\w*)$/.exec(input);
  if (!match) return [];
  const slug = match[2].toLowerCase();
  if (!slug) return QUICK_REPLIES.slice(0, 6);
  return QUICK_REPLIES.filter((r) => r.shortcut.startsWith(slug)).slice(0, 6);
}

export function replaceSlash(input: string, replaceWith: string): string {
  const match = /(^|[\n ])\/\w*$/.exec(input);
  if (!match) return input;
  const triggerStart = match.index + match[1].length;
  const before = input.slice(0, triggerStart);
  if (before.trim()) {
    return before.trimEnd() + "\n" + replaceWith;
  }
  return replaceWith;
}
