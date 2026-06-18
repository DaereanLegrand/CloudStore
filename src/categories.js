export const CATEGORIES = [
  { value: 'abarrotes', label: 'Abarrotes' },
  { value: 'bebes', label: 'Bebés' },
  { value: 'bebidas', label: 'Bebidas' },
  { value: 'carnes', label: 'Carnes, Aves y Pescados' },
  { value: 'congelados', label: 'Congelados' },
  { value: 'cuidado-personal', label: 'Cuidado Personal' },
  { value: 'deportes', label: 'Deportes' },
  { value: 'electronica', label: 'Electrónica' },
  { value: 'fiambres', label: 'Fiambres' },
  { value: 'frutas-verduras', label: 'Frutas y Verduras' },
  { value: 'hogar', label: 'Hogar' },
  { value: 'lacteos', label: 'Lácteos y Huevos' },
  { value: 'libros', label: 'Libros' },
  { value: 'licores', label: 'Licores' },
  { value: 'mascotas', label: 'Mascotas' },
  { value: 'otros', label: 'Otros' },
  { value: 'panaderia', label: 'Panadería y Pastelería' },
  { value: 'ropa', label: 'Ropa' },
  { value: 'snacks', label: 'Snacks' },
]

export const CATEGORIES_DICT = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
)
