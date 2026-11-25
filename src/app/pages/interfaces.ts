/** @format */

export interface Products {
  id: any;
  marca: string;
  referencia: string;
  imagen: string;
  tallasDisponibles: { [talla: number]: number };
  stock?: number;
  stockInicial?: number;
  precioMin?: number | null;
  precioAdquisicion?: number | null;
  tallaseleccionada?: string;
  venta?: Venta;
  fila?: string;
  pl?: string;
  mostrarImagen?: boolean;
  soloExhibicion?: boolean;
  valorInventario?: number;
}

export interface ingresoTalla {
  id?: string;
  zapatoId: number;
  marca: string;
  referencia: string;
  cantIngresada: string;
  fecha: any;
  nombre: string;
}

export interface Pedido {
  id: string;
  zapatoId: number;
  marca: string;
  referencia: string;
  procesando?: boolean;

  talla: string;
  imagen: string;
  estado: 'Pendiente' | 'Aceptado' | 'Recibido' | 'No Recibido' | 'Devuelto';
  hora: string;
  local?: string;
  vendedor?: string | any;
  fila?: string;
  precio?: number;
  metodoPago?: string;
  productoDevueltoId?: string;
  vendedorId?: string;
  tipoDevolucion?: 'cambio' | 'bono' | 'prestamo' | 'pedido';
}

export interface Venta {
  zapatoId?: number;
  id: string;
  marca: string;
  referencia: string;
  talla: string;
  imagen?: string;
  precio: number;
  local?: string;
  localPrestado?: string;
  metodoPago: string;
  precioMetodoPrincipal?: number;
  segundoMetodo?: {
    metodo: string;
    precio: number;
  };
  fechaVenta: Date;
  numCliente?: string;
  tipoVenta: 'venta' | 'prestamo' | string;
  vendedor?: string;
  precioBajo?: boolean;
  precioBono?: string | number;
  DevueltoBono?: boolean;
  productoDevueltoId?: string;
  excedente?: number;
  metodoExcedente?: string;
  precioCompra?: number;
  DevueltoCambio?: boolean;
  /** Precio que tenía la venta antes de anularla por un cambio hecho en un día posterior. */
  precioAntesDeCambio?: number;
  vendedorId?: string;
  nombrePresador?: string;
  comentario?: string;
  esMismoDia?: boolean;
  localSalido?: string;
  localOrigenId?: string;
  esPL?: boolean;
  pagado?: boolean;
}

export interface ProductAlmacen {
  id: string;
  marca: string;
  referencia: string;
  image: string;
  metodoPago?: string;
  vendedor: string;
  tallasDisponibles?: { [talla: number]: number };
  talla: string;
  stock: string;
  pedido?: any;
  zapatoId: string;
}

export interface Prestamo {
  zapatoId: number;
  id: string;
  marca: string;
  localInicio?: string;
  talla: string;
  referencia: string;
  imagen: string;
  local?: string;
  localPrestado?: string;
  precio: number;
  fechaPrestamo?: Date;
  estado?: 'prestado' | 'devuelto' | 'vendido';
  metodoPago?: string;
  fechaDevolucion?: Date;
  fechaVenta?: Date;
  tipoVenta: 'venta' | 'prestamo' | string;
  vendedor?: string;
  esprecioBajo?: boolean;
  vendedorId?: string;
  comentario?: string;
  localSalido?: string;
  localOrigenId?: string;
  esPL?: boolean;
}

export interface User {
  id?: string;
  email?: string;
  password?: string;
  name: string;
  role: 'vendedor' | 'bodega' | 'admin' | 'patinador';
  active: {
    label: string;
    value: boolean;
  };
  fcmTokens?: string[];
  local?: string;
  numeroBodega?: string;
  emailReporte?: string;
  prestamosActivos?: {
    label: string;
    value: boolean;
  };
  accesoPremier?: boolean;
  restriccionesActivas?: boolean;
  /** Vendedor habilitado por el admin para recoger el efectivo de los demás vendedores. */
  recolectorCaja?: boolean;
}

export interface exhibiciones {
  id?: string;
  marca: string;
  referencia: string;
  talla: string;
  locales: string[];
  imagen?: string;
  zapatoId?: string;
  estado?: string;
  localPedido?: string;
  localOriginal?: string[];
  vendedor?: string;
  vendedorId?: string;
  fechaPedido?: string | Date;
  fechaAceptado?: string | Date;
  fechaDevuelto?: string | Date;
  fechaDevAceptada?: string | Date;
  vendedorAceptado?: string;
  porFuera?: boolean;
  pendienteRecibir?: boolean;
  fechahoraEnviado?: string | Date;
  enviadoPor?: string;
  recibidoPor?: string;
  fechahoraRecibido?: string | Date;
  origenLocal?: boolean;
  localSalido?: string;
  precioAdquisicion?: number | null;
}

export interface Notification {
  id: string | number;
  tipo: 'venta-minimo' | 'stock-bajo' | string;
  titulo?: string;
  mensaje?: string;
  producto: {
    nombre: string;
    referencia: string;
    talla?: string | number;
    zapatoId?: number;
  };
  precioVenta?: number;
  precioMinimo?: number;
  vendedor?: string;
  local?: string;
  fila?: string;

  fecha: string | Date;
  nueva: boolean;
  locales?: string[];
  image?: string;
  precioBono?: string;
}

export interface Bono {
  id: string;
  precioBono: number;
  vendedor: string;
  tallaADevolver: string;
  motivo: string;
  comentario: string;
  producto: Venta;
  vendedorId?: string;
}

export interface historial {
  id: string;
  marca: string;
  referencia: string;
  zapatoId: number | string;
  talla: string;
  lugar: 'exhibicion' | 'pedido';
  tipo: 'salida' | 'devolucion';
  vendedor?: string;
  fecha: string;
  bodega: string;
  locales?: string[];
}

export interface PagosConfig {
  pagoDiarioBodega: number;
  pagoDiarioVendedor: number;
  pagoDiarioPatinador: number;
  comisionPorZapato: number;
}

export interface Proveedor {
  id?: string;
  nombre: string;
  descripcion: string;
  facturas?: Factura[];
}

export interface Factura {
  facturaId: string;
  fecha: Date | string;
  numeroFactura: string;
  producto: string;
  estado: 'pendiente' | 'cancelada';
  valorInicial: number;
  abonos?: abono[];
  deudaPendiente: number;
}

export interface abono {
  fecha: Date | string;
  cantidad: number;
  descripcion: string;
}

export interface InventarioLocal {
  id?: string;
  productoId: number;
  localId: string;
  localNombre: string;
  marca: string;
  referencia: string;
  imagen: string;
  tallasDisponibles: { [talla: number]: number };
  stock: number;
  fechaActualizacion: Date;
}

export interface MovimientoInventario {
  id?: string;
  productoId: number;
  marca: string;
  referencia: string;
  talla: number;
  cantidad: number;
  tipo: 'envio' | 'devolucion';
  localId: string;
  localNombre: string;
  usuario: string;
  fecha: Date;
}

export interface PedidoLocal {
  id?: string;
  productoId: number;
  talla: number;
  marca: string;
  referencia: string;
  imagen: string;

  localOrigenId: string;
  localOrigenNombre: string;

  estado: 'solicitado' | 'aceptado' | 'devuelto';
  porFuera: boolean;
  tipoDevolucion?: 'cambio' | 'bono';
  productoDevueltoId?: string;
  solicitadoPorNombre: string;
  solicitadoPorId: string;
  localSolicitanteId: string;
  fechaSolicitud: any;

  aceptadoPorNombre?: string;
  aceptadoPorId?: string;
  fechaAceptacion?: any;

  devueltoPorNombre?: string;
  devueltoPorId?: string;
  fechaDevolucion?: any;
}
export interface HistorialLocal {
  id?: string;
  marca: string;
  referencia: string;
  zapatoId: number;
  talla: string;
  fecha: string;
  tipo: 'salida' | 'entrada';
  lugar: 'exhibicion' | 'pedido' | string;
  localOrigen: string;
  locales: string[];
  enviadoPor?: string;

  solicitadoPorNombre?: string;
  solicitadoPorId?: string;
  fechaSolicitud?: string;

  aceptadoPorNombre?: string;
  aceptadoPorId?: string;
  fechaAceptacion?: string;

  devueltoPorNombre?: string;
  devueltoPorId?: string;
  fechaDevolucion?: string;
}

export interface AvisoExhibicionLocal {
  id?: string;
  tipo:
    | 'venta-exhibicion-local'
    | 'cambio-exhibicion-local'
    | 'prestamo-exhibicion-local';

  titulo?: string;
  producto: {
    nombre: string;
    referencia: string;
    talla?: string | number;
    zapatoId?: number;
  };
  fecha: string | Date;
  nueva: boolean;
  locales?: string[];
  image?: string;
  vendedor?: string;
  fila?: string;
  mensaje?: string;
  precioVenta?: number;
  localSalido?: string;
}
