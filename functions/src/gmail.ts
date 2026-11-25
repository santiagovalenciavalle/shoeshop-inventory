import { createTransport } from 'nodemailer';

export interface ReporteData {
  fecha: string;
  ventas: {
    total: number;
    ingresoTotal: number;
    preciosBajos: number;
    lider: string;
    porLocal: Record<string, { ventas: number; ingresos: number }>;
  };
  bodega: {
    pedidosHoy: number;
    exhibHoy: number;
    salidasHoy: number;
    devolucionesHoy: number;
    paresNetos: number;
    exhibicionesPendientes: number;
  };
  pedidos: {
    pendientes: number;
    recibidos: number;
    devueltos: number;
    viejosRecibidos: number;
    devueltosViejos: number;
  };
  prestamos: {
    total: number;
    criticos: number;
  };
  llegadas: {
    total: number;
    tarde: number;
    nombresTarde: string;
  };
  clima?: ClimaPronostico | null;
  prediccion?: PrediccionTrafico | null;
}

export interface BloqueHorario {
  hora: string;
  hora24: number;
  descripcion: string;
  temp: number;
  probLluvia: number;
  lluviaMM: number;
  icono: string;
  esLluvioso: boolean;
}

export interface ClimaPronostico {
  descripcion: string;
  lluvia: boolean;
  lluviaIntensa: boolean;
  tempMin: number;
  tempMax: number;
  iconoCodigo: string;
  humedad: number;
  vientoKmh: number;
  probLluvia: number;
  bloquesHorarios: BloqueHorario[];
  horasLluvia: string;
  resumenDinamico: string;
}

interface OWBlock {
  dt_txt: string;
  rain?: { '3h'?: number };
  weather?: { main: string; description: string; icon: string }[];
  main: { temp: number; temp_min: number; temp_max: number; humidity: number };
  wind?: { speed: number };
  pop?: number;
}

interface OWForecastResponse {
  list: OWBlock[];
}

function horaLabel(hora24: number): string {
  const ampm = hora24 >= 12 ? 'PM' : 'AM';
  const h12 = hora24 === 0 ? 12 : hora24 > 12 ? hora24 - 12 : hora24;
  return `${h12}:00`;
}

export async function obtenerPronosticoManana(
  apiKey: string,
  ciudad: string = 'Medellin,CO',
): Promise<ClimaPronostico | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${ciudad}&appid=${apiKey}&units=metric&lang=es&cnt=16`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as OWForecastResponse;

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.toISOString().split('T')[0];

    const bloques = data.list.filter((b) => b.dt_txt.startsWith(mananaStr));

    if (!bloques.length) return null;

    const lluviaBloques = bloques.filter(
      (b) =>
        b.rain?.['3h'] ||
        b.weather?.[0]?.main === 'Rain' ||
        b.weather?.[0]?.main === 'Drizzle' ||
        b.weather?.[0]?.main === 'Thunderstorm',
    );

    const lluviaTotal = bloques.reduce(
      (acc, b) => acc + (b.rain?.['3h'] ?? 0),
      0,
    );
    const tempMin = Math.min(...bloques.map((b) => b.main.temp_min));
    const tempMax = Math.max(...bloques.map((b) => b.main.temp_max));
    const bloqueRepresentativo = bloques[Math.floor(bloques.length / 2)];
    const humedadProm = Math.round(
      bloques.reduce((acc, b) => acc + b.main.humidity, 0) / bloques.length,
    );
    const vientoProm = Math.round(
      (bloques.reduce((acc, b) => acc + (b.wind?.speed ?? 0), 0) /
        bloques.length) *
        3.6,
    );
    const probLluviaProm = Math.round(
      (bloques.reduce((acc, b) => acc + (b.pop ?? 0), 0) / bloques.length) *
        100,
    );

    const bloquesHorarios: BloqueHorario[] = bloques.map((b) => {
      const horaRaw = b.dt_txt.split(' ')[1];
      const [h] = horaRaw.split(':').map(Number);
      const probLluvia = Math.round((b.pop ?? 0) * 100);
      const lluviaMM = b.rain?.['3h'] ?? 0;
      return {
        hora: horaLabel(h),
        hora24: h,
        descripcion: b.weather?.[0]?.description ?? 'despejado',
        temp: Math.round(b.main.temp),
        probLluvia,
        lluviaMM,
        icono: b.weather?.[0]?.icon ?? '01d',
        esLluvioso: !!(
          b.rain?.['3h'] ||
          b.weather?.[0]?.main === 'Rain' ||
          b.weather?.[0]?.main === 'Drizzle' ||
          b.weather?.[0]?.main === 'Thunderstorm'
        ),
      };
    });

    const bloquesLluvia = bloquesHorarios.filter((b) => b.esLluvioso);
    let horasLluvia = '';
    if (bloquesLluvia.length === 0) {
      horasLluvia = 'No se espera lluvia durante el día';
    } else {
      const grupos: { inicio: string; fin: string }[] = [];
      let inicioGrupo = bloquesLluvia[0];
      let ultimo = bloquesLluvia[0];
      for (let i = 1; i < bloquesLluvia.length; i++) {
        if (bloquesLluvia[i].hora24 === ultimo.hora24 + 3) {
          ultimo = bloquesLluvia[i];
        } else {
          grupos.push({ inicio: inicioGrupo.hora, fin: ultimo.hora });
          inicioGrupo = bloquesLluvia[i];
          ultimo = bloquesLluvia[i];
        }
      }
      grupos.push({ inicio: inicioGrupo.hora, fin: ultimo.hora });
      horasLluvia = grupos
        .map((g) => (g.inicio === g.fin ? g.inicio : `${g.inicio} – ${g.fin}`))
        .join(', ');
    }

    let resumenDinamico = '';
    if (bloquesLluvia.length === 0) {
      if (probLluviaProm < 20) {
        resumenDinamico =
          'Cielo mayormente despejado durante todo el día. Sin probabilidad de lluvia significativa. Ideal para operar sin interrupciones climáticas.';
      } else {
        resumenDinamico =
          'Baja probabilidad de lluvia durante el día. Posibles nubes pasajeras sin mayor afectación.';
      }
    } else if (lluviaTotal >= 15) {
      resumenDinamico = `Lluvia intensa y generalizada durante el día (${lluviaTotal.toFixed(1)}mm acumulados). Las precipitaciones serán constantes y podrían afectar la afluencia de clientes. Precaución con desplazamientos.`;
    } else if (lluviaTotal >= 8) {
      resumenDinamico = `Lluvia moderada a intensa en varios momentos del día (${lluviaTotal.toFixed(1)}mm acumulados). Se esperan al menos ${bloquesLluvia.length} bloques con precipitación activa, principalmente en ${horasLluvia}.`;
    } else if (bloquesLluvia.length >= 3) {
      resumenDinamico = `Lluvia intermitente durante el día con ${bloquesLluvia.length} bloques de precipitación. Los momentos más críticos serán en ${horasLluvia}. Probabilidad media de lluvia en ${probLluviaProm}% del día.`;
    } else {
      resumenDinamico = `Lluvia ligera en momentos puntuales del día (${lluviaTotal.toFixed(1)}mm), especialmente en ${horasLluvia}. No se espera que afecte significativamente la operación.`;
    }

    return {
      descripcion:
        bloqueRepresentativo.weather?.[0]?.description ?? 'despejado',
      lluvia: lluviaBloques.length >= 2,
      lluviaIntensa: lluviaTotal >= 10,
      tempMin: Math.round(tempMin),
      tempMax: Math.round(tempMax),
      iconoCodigo: bloqueRepresentativo.weather?.[0]?.icon ?? '01d',
      humedad: humedadProm,
      vientoKmh: vientoProm,
      probLluvia: probLluviaProm,
      bloquesHorarios,
      horasLluvia,
      resumenDinamico,
    };
  } catch {
    return null;
  }
}

export interface PrediccionTrafico {
  nivel: 'ALTO' | 'MEDIO' | 'NORMAL' | 'BAJO';
  porcentajeExtra: number;
  razon: string;
  recomendacion: string;
}

export function predecirTrafico(
  clima: ClimaPronostico | null,
  fechaManana: Date,
): PrediccionTrafico {
  const diaSemana = fechaManana.getDay();
  const dia = fechaManana.getDate();
  const esSabado = diaSemana === 6;
  const esQuincena =
    esSabado && ((dia >= 13 && dia <= 17) || (dia >= 28 && dia <= 31));
  const llueve = clima?.lluvia ?? false;
  const lluviaIntensa = clima?.lluviaIntensa ?? false;
  const horasLluvia = clima?.horasLluvia ?? '';
  const resumenClima = clima?.resumenDinamico ?? '';

  const DIAS = [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ];
  const MESES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const nombreDia = DIAS[diaSemana];
  const nombreMes = MESES[fechaManana.getMonth()];
  const fechaTexto = `${nombreDia} ${dia} de ${nombreMes}`;

  const bloquesManana = clima?.bloquesHorarios ?? [];
  const horasPico = bloquesManana.filter(
    (b) => b.hora24 >= 10 && b.hora24 <= 16,
  );
  const lluviaEnPico = horasPico.filter((b) => b.esLluvioso).length;
  const afectacionPico =
    lluviaEnPico > 0
      ? `Habrá lluvia durante horas pico (${horasPico
          .filter((b) => b.esLluvioso)
          .map((b) => b.hora)
          .join(', ')})`
      : '';

  if (esQuincena && llueve) {
    return {
      nivel: 'MEDIO',
      porcentajeExtra: 15,
      razon: `Mañana, ${fechaTexto}, es quincena pero el clima no ayuda. ${resumenClima} ${afectacionPico ? afectacionPico + '. ' : ''}Esto va a frenar parte de la afluencia típica de quincena. Aun así, habrá más movimiento que un sábado normal.`,
      recomendacion: [
        'Equipo completo desde la apertura, aunque el pico máximo probablemente no se alcance.',
        'Priorizar atención en caja: los clientes que lleguen suelen venir con intención de compra definida.',
        'Aprovechar los momentos de menor flujo para reponer exhibiciones y organizar tallas.',
        lluviaIntensa
          ? 'Se pronostica lluvia intensa — preparar la entrada de la tienda y tener toallas o tapetes antideslizantes.'
          : '',
      ]
        .filter(Boolean)
        .join('||'),
    };
  }

  if (esQuincena) {
    return {
      nivel: 'ALTO',
      porcentajeExtra: 30,
      razon: `Mañana, ${fechaTexto}, es quincena — el día de mayor movimiento del mes en el centro comercial. La gente sale a gastar con el pago recién recibido y los pasillos van a estar llenos desde temprano.`,
      recomendacion: [
        'Todo el equipo debe estar desde la apertura, sin excepciones ni retrasos.',
        'Revisar stock de tallas más vendidas antes de abrir: no debe haber huecos en el local de exhibiciones.',
        'Asegurarse de que los vendedores tengan cambio suficiente.',
        'Evitar inventarios, tareas de bodega o movimientos internos hasta después de las 4pm.',
        'Si hay promoción activa, tenerla visible en la entrada desde primera hora.',
      ].join('||'),
    };
  }

  if (esSabado && llueve) {
    return {
      nivel: 'NORMAL',
      porcentajeExtra: 0,
      razon: `Mañana, ${fechaTexto}, con lluvia. ${resumenClima} El clima va a bajar el efecto de fin de semana y se espera un flujo de clientes similar a un día entre semana normal.${afectacionPico ? ' ' + afectacionPico + '.' : ''}`,
      recomendacion: [
        'Operación estándar, sin necesidad de refuerzo extra de personal.',
        'Buen día para poner al día tareas internas: trastienda, pedidos y organización de almacén.',
        'Aprovechar el tiempo tranquilo para capacitar al equipo o revisar pendientes administrativos.',
        lluviaIntensa
          ? 'Lluvia intensa prevista: los clientes que lleguen lo harán más tarde de lo habitual, no antes de las 11am.'
          : '',
      ]
        .filter(Boolean)
        .join('||'),
    };
  }

  if (esSabado) {
    return {
      nivel: 'MEDIO',
      porcentajeExtra: 15,
      razon: `Mañana, ${fechaTexto}, sin lluvia — el centro comercial va a tener más movimiento que entre semana. No es quincena, pero sí es un día activo donde la gente sale a pasear y a comprar.`,
      recomendacion: [
        'Equipo completo y puntual desde la apertura.',
        'Revisar y limpiar las exhibiciones principales antes de abrir.',
        'Monitorear el flujo desde las 11am: suele ser cuando empieza el pico del sábado.',
        'Mantener el piso despejado y el equipo visible para atender sin demoras.',
      ].join('||'),
    };
  }

  if (llueve) {
    return {
      nivel: 'BAJO',
      porcentajeExtra: -15,
      razon: `Mañana, ${fechaTexto}, se espera lluvia. ${resumenClima} La gente evita salir al centro comercial cuando llueve entre semana, así que el flujo de clientes va a ser notablemente menor a lo normal.${afectacionPico ? ' ' + afectacionPico + '.' : ''}`,
      recomendacion: [
        'Día ideal para tareas internas: inventario, organización de almacén y bodega.',
        'Revisar y cerrar todos los pedidos de días anteriores con bodega y vendedores.',
        'Actualizar exhibiciones y aprovechar para limpiar y ordenar el local a fondo.',
        lluviaIntensa
          ? 'Se pronostica lluvia intensa — prever posibles retrasos en las llegadas del equipo y comunicarlo con anticipación.'
          : '',
      ]
        .filter(Boolean)
        .join('||'),
    };
  }

  return {
    nivel: 'NORMAL',
    porcentajeExtra: 0,
    razon: `Mañana, ${fechaTexto}, es un día entre semana sin lluvia. ${resumenClima} Se espera el flujo habitual de clientes, sin picos ni caídas. Una jornada estándar para operar con normalidad.`,
    recomendacion: [
      'Operación estándar sin alertas especiales.',
      'Revisar métricas de la semana y ajustar metas si es necesario.',
      'Aprovechar el ritmo tranquilo para mantener el local impecable.',
    ].join('||'),
  };
}

export async function enviarReporteEmail(
  gmailUser: string,
  gmailPass: string,
  destinatarios: string[],
  reporte: ReporteData,
): Promise<void> {
  const transporter = createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  await transporter.sendMail({
    from: `"ShoeShop IA" <${gmailUser}>`,
    to: destinatarios.join(', '),
    subject: `📊 Reporte Diario · ${reporte.fecha}`,
    html: generarHtmlReporte(reporte),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCOP(n: number): string {
  return '$' + n.toLocaleString('es-CO');
}

function nivelLluvia(prob: number): string {
  if (prob >= 70) return 'Muy probable';
  if (prob >= 40) return 'Probable';
  if (prob >= 15) return 'Poco probable';
  return 'Sin lluvia';
}

function simplificarDescripcion(desc: string): string {
  const mapa: Record<string, string> = {
    'cielo claro': 'soleado',
    'pocas nubes': 'despejado',
    'nubes dispersas': 'nublado',
    'muy nuboso': 'muy nublado',
    nubes: 'nublado',
    'lluvia ligera': 'llovizna',
    'lluvia moderada': 'lluvia',
    'lluvia de gran intensidad': 'aguacero',
    'lluvia intensa': 'aguacero',
    tormenta: 'tormenta',
    'tormenta eléctrica': 'tormenta',
    'lluvia y nieve': 'lluvia',
    niebla: 'niebla',
    neblina: 'neblina',
    lluvia: 'lluvia',
    llovizna: 'llovizna',
  };
  const key = desc.toLowerCase().trim();
  return mapa[key] || desc;
}

// ─── Paleta luxury ──────────────────────────────────────────────────────────
// BG página:  #040408   BG email: #07070f   Card: #0c0c18   Surface: #101020
// Gold:       #c9a227   Gold dim: #7a5e18   Gold bg: #100d04
// Text:       #eef0f8   Secondary: #7a8a9a  Muted: #3a4858
// Blue lluvia:#2563eb   Verde:     #059669  Rojo:  #dc2626  Amber: #d97706
// ─────────────────────────────────────────────────────────────────────────────

function generarTimelineClima(
  bloques: BloqueHorario[],
  probGeneral: number,
): string {
  const horas = bloques.filter((b) => b.hora24 >= 9 && b.hora24 <= 18);
  if (!horas.length) return '';

  const ROW_BG = '#07070f';
  const HEAD_BG = '#050509';
  const CONT_BG = '#07070f';
  const BORDER = '#13131f';

  const filas = horas
    .map((b) => {
      const barColor =
        b.probLluvia >= 70
          ? '#1d4ed8'
          : b.probLluvia >= 40
            ? '#2563eb'
            : b.probLluvia >= 15
              ? '#3b82f6'
              : '#1a1a2e';

      const labelColor =
        b.probLluvia >= 70
          ? '#60a5fa'
          : b.probLluvia >= 40
            ? '#93c5fd'
            : b.probLluvia >= 15
              ? '#bfdbfe'
              : '#2a3040';

      const iconoUrl = `https://openweathermap.org/img/wn/${b.icono}.png`;
      const nivel = nivelLluvia(b.probLluvia);
      const descSimp = simplificarDescripcion(b.descripcion);
      const bw = Math.max(5, b.probLluvia);

      return `
      <tr>
        <td bgcolor="${ROW_BG}" style="background:${ROW_BG};background-color:${ROW_BG} !important;padding:8px 10px;border-bottom:1px solid ${BORDER};white-space:nowrap;width:50px">
          <p style="margin:0;font-size:11px;font-weight:600;color:#4a5868 !important;font-family:'Courier New',monospace">${b.hora}</p>
        </td>
        <td bgcolor="${ROW_BG}" style="background:${ROW_BG};background-color:${ROW_BG} !important;padding:8px 4px;border-bottom:1px solid ${BORDER};width:26px;text-align:center">
          <img src="${iconoUrl}" alt="${descSimp}" width="20" height="20" style="display:block;width:20px;height:20px;border:0;margin:0 auto"/>
        </td>
        <td bgcolor="${ROW_BG}" style="background:${ROW_BG};background-color:${ROW_BG} !important;padding:8px 8px 8px 0;border-bottom:1px solid ${BORDER};width:44px">
          <p style="margin:0;font-size:12px;color:#d0d8e8 !important;font-weight:700;font-family:'Courier New',monospace">${b.temp}°</p>
        </td>
        <td bgcolor="${ROW_BG}" style="background:${ROW_BG};background-color:${ROW_BG} !important;padding:8px 8px;border-bottom:1px solid ${BORDER}">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td bgcolor="#0d1520" style="background:#0d1520;background-color:#0d1520 !important;border-radius:3px;height:6px;overflow:hidden">
                <table width="${bw}%" cellpadding="0" cellspacing="0" height="6">
                  <tr>
                    <td bgcolor="${barColor}" style="background:${barColor};background-color:${barColor} !important;height:6px;border-radius:3px"> </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
        <td bgcolor="${ROW_BG}" style="background:${ROW_BG};background-color:${ROW_BG} !important;padding:8px 8px;border-bottom:1px solid ${BORDER};white-space:nowrap;text-align:right;width:90px">
          <p style="margin:0;font-size:9px;font-weight:${b.probLluvia >= 40 ? '700' : '400'};color:${labelColor} !important;font-family:'Courier New',monospace">${nivel}</p>
        </td>
        <td bgcolor="${ROW_BG}" style="background:${ROW_BG};background-color:${ROW_BG} !important;padding:8px 10px;border-bottom:1px solid ${BORDER};width:72px">
          <p style="margin:0;font-size:9px;color:#374050 !important;text-transform:capitalize">${descSimp}</p>
        </td>
      </tr>`;
    })
    .join('');

  const promLabel = nivelLluvia(probGeneral);
  const promColor =
    probGeneral >= 70
      ? '#2563eb'
      : probGeneral >= 40
        ? '#3b82f6'
        : probGeneral >= 15
          ? '#60a5fa'
          : '#2a3040';
  const promBW = Math.max(4, probGeneral);

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px">
    <tr>
      <td bgcolor="${CONT_BG}" style="background:${CONT_BG};background-color:${CONT_BG} !important;border:1px solid ${BORDER};border-radius:8px;overflow:hidden;padding:0">

        <!-- encabezado tabla -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:7px 12px;border-bottom:1px solid ${BORDER}">
              <p style="margin:0;font-size:7px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#2a3848 !important;font-family:'Courier New',monospace">⏳ PRONÓSTICO DEL DÍA · 9AM–6PM</p>
            </td>
          </tr>
        </table>

        <!-- cabeceras columnas -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <th bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:5px 10px;font-size:6px;font-weight:700;color:#2a3040 !important;text-transform:uppercase;letter-spacing:0.14em;font-family:'Courier New',monospace;text-align:left;border-bottom:1px solid ${BORDER}">HORA</th>
            <th bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:5px 4px;font-size:6px;font-weight:700;color:#2a3040 !important;text-align:center;border-bottom:1px solid ${BORDER}"> </th>
            <th bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:5px 8px 5px 0;font-size:6px;font-weight:700;color:#2a3040 !important;text-transform:uppercase;letter-spacing:0.14em;font-family:'Courier New',monospace;text-align:left;border-bottom:1px solid ${BORDER}">TEMP</th>
            <th bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:5px 8px;font-size:6px;font-weight:700;color:#2a3040 !important;text-transform:uppercase;letter-spacing:0.14em;font-family:'Courier New',monospace;text-align:left;border-bottom:1px solid ${BORDER}">LLUVIA</th>
            <th bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:5px 8px;font-size:6px;font-weight:700;color:#2a3040 !important;text-transform:uppercase;letter-spacing:0.14em;font-family:'Courier New',monospace;text-align:right;border-bottom:1px solid ${BORDER}">NIVEL</th>
            <th bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:5px 10px;font-size:6px;font-weight:700;color:#2a3040 !important;text-transform:uppercase;letter-spacing:0.14em;font-family:'Courier New',monospace;text-align:left;border-bottom:1px solid ${BORDER}">CLIMA</th>
          </tr>
          ${filas}
        </table>

        <!-- footer general -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td bgcolor="${HEAD_BG}" style="background:${HEAD_BG};background-color:${HEAD_BG} !important;padding:8px 12px;border-top:1px solid ${BORDER}">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:72px">
                    <p style="margin:0;font-size:7px;font-weight:700;color:#2a3848 !important;text-transform:uppercase;letter-spacing:0.14em;font-family:'Courier New',monospace">GENERAL</p>
                  </td>
                  <td style="padding:0 10px">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td bgcolor="#0d1520" style="background:#0d1520;background-color:#0d1520 !important;border-radius:3px;height:5px;overflow:hidden">
                          <table width="${promBW}%" cellpadding="0" cellspacing="0" height="5">
                            <tr>
                              <td bgcolor="${promColor}" style="background:${promColor};background-color:${promColor} !important;height:5px;border-radius:3px"> </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width:100px;text-align:right">
                    <p style="margin:0;font-size:10px;font-weight:600;color:${promColor} !important;font-family:'Courier New',monospace">${promLabel}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>`;
}

function generarBloqueClima(
  clima: ClimaPronostico | null,
  prediccion: PrediccionTrafico | null,
): string {
  if (!clima || !prediccion) return '';

  // Configuración por nivel de tráfico
  const NIVEL_CONFIG: Record<
    'ALTO' | 'MEDIO' | 'NORMAL' | 'BAJO',
    {
      bg: string;
      border: string;
      label: string;
      labelColor: string;
      textColor: string;
      badge: string;
      badgeBorder: string;
    }
  > = {
    ALTO: {
      bg: '#0b0800',
      border: '#c9a227',
      label: 'ALTO',
      labelColor: '#c9a227',
      textColor: '#f0d98a',
      badge: '#15100a',
      badgeBorder: '#4a3510',
    },
    MEDIO: {
      bg: '#03060e',
      border: '#2563eb',
      label: 'MEDIO',
      labelColor: '#3b82f6',
      textColor: '#bfdbfe',
      badge: '#040c1a',
      badgeBorder: '#0e2040',
    },
    NORMAL: {
      bg: '#020b06',
      border: '#059669',
      label: 'NORMAL',
      labelColor: '#10b981',
      textColor: '#a7f3d0',
      badge: '#030f08',
      badgeBorder: '#073d20',
    },
    BAJO: {
      bg: '#05050c',
      border: '#4f46e5',
      label: 'BAJO',
      labelColor: '#6366f1',
      textColor: '#c7d2fe',
      badge: '#080814',
      badgeBorder: '#1a1840',
    },
  };

  const cfg = NIVEL_CONFIG[prediccion.nivel];
  // Helper para inline style con bg forzado en cada celda
  const cs = (extra = '') =>
    `background:${cfg.bg};background-color:${cfg.bg} !important;${extra}`;

  const iconoUrl = `https://openweathermap.org/img/wn/${clima.iconoCodigo}@2x.png`;

  const porcentajeTexto =
    prediccion.porcentajeExtra > 0
      ? `+${prediccion.porcentajeExtra}% de afluencia estimada`
      : prediccion.porcentajeExtra < 0
        ? `${prediccion.porcentajeExtra}% de la afluencia habitual`
        : 'Afluencia dentro de parámetros normales';

  const probColor =
    clima.probLluvia >= 60
      ? '#3b82f6'
      : clima.probLluvia >= 30
        ? '#60a5fa'
        : '#3a4858';

  const bullets = prediccion.recomendacion
    .split('||')
    .filter(Boolean)
    .map(
      (b) => `
      <tr>
        <td style="padding:4px 0;vertical-align:top;width:16px">
          <span style="color:${cfg.labelColor} !important;font-family:'Courier New',monospace;font-size:13px;line-height:1">›</span>
        </td>
        <td style="padding:4px 0 4px 8px;font-size:12px;color:#8899aa !important;line-height:1.65">${b}</td>
      </tr>`,
    )
    .join('');

  const lluviaIntensaTag = clima.lluviaIntensa
    ? `<span style="color:#ef4444 !important;font-weight:700;margin-left:8px">⚡ Lluvia intensa</span>`
    : '';

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">

    <!-- Etiqueta sección -->
    <tr>
      <td style="padding-bottom:14px">
        <p style="margin:0;font-size:7px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:#2a3848 !important;font-family:'Courier New',monospace">── PRONÓSTICO DE MAÑANA ──────────────────────</p>
      </td>
    </tr>

    <!-- Tarjeta principal -->
    <tr>
      <td bgcolor="${cfg.bg}" style="${cs()}border:1px solid ${cfg.border}3a;border-left:3px solid ${cfg.border};border-radius:0 10px 10px 0;padding:0;overflow:hidden">
        <table width="100%" cellpadding="0" cellspacing="0">

          <!-- HEADER: badge nivel + ícono clima -->
          <tr>
            <td bgcolor="${cfg.bg}" style="${cs()}padding:20px 22px 16px;border-bottom:1px solid ${cfg.border}20">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle">
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:6px">
                      <tr>
                        <td bgcolor="${cfg.badge}" style="background:${cfg.badge};background-color:${cfg.badge} !important;border:1px solid ${cfg.badgeBorder};border-radius:6px;padding:5px 13px">
                          <p style="margin:0;font-size:8px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${cfg.labelColor} !important;font-family:'Courier New',monospace">TRÁFICO ${cfg.label}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:11px;color:#3a4858 !important;font-family:'Courier New',monospace;letter-spacing:0.03em">${porcentajeTexto}</p>
                  </td>
                  <td align="right" style="vertical-align:top;width:68px">
                    <img src="${iconoUrl}" alt="${clima.descripcion}" width="56" height="56" style="display:block;width:56px;height:56px;border:0"/>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- RESUMEN DINÁMICO -->
          <tr>
            <td bgcolor="${cfg.bg}" style="${cs()}padding:16px 22px 10px">
              <p style="margin:0;font-size:12px;color:#b0bac8 !important;line-height:1.75;font-weight:400">${clima.resumenDinamico}</p>
            </td>
          </tr>

          <!-- HORAS DE LLUVIA (condicional) -->
          ${
            clima.bloquesHorarios.some((b) => b.esLluvioso)
              ? `
          <tr>
            <td bgcolor="${cfg.bg}" style="${cs()}padding:4px 22px 12px">
              <p style="margin:0;font-size:11px;color:#5a8ab8 !important;font-family:'Courier New',monospace">
                🌧 <span style="font-weight:600;color:#7aacda !important">Lluvia en:</span> ${clima.horasLluvia}${lluviaIntensaTag}
              </p>
            </td>
          </tr>`
              : ''
          }

          <!-- TIMELINE HORARIO -->
          <tr>
            <td bgcolor="${cfg.bg}" style="${cs()}padding:6px 16px 6px;border-top:1px solid ${cfg.border}18;border-bottom:1px solid ${cfg.border}18">
              ${generarTimelineClima(clima.bloquesHorarios, clima.probLluvia)}
            </td>
          </tr>

          <!-- MÉTRICAS CLIMA -->
          <tr>
            <td bgcolor="${cfg.bg}" style="${cs()}padding:16px 22px;border-bottom:1px solid ${cfg.border}18">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Temperatura -->
                  <td width="25%" style="text-align:center;padding:0 8px 0 0;border-right:1px solid #141424">
                    <p style="margin:0 0 5px;font-size:7px;color:#2a3848 !important;text-transform:uppercase;letter-spacing:0.16em;font-family:'Courier New',monospace">🌡 TEMP.</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:#e8eef4 !important;font-family:'Courier New',monospace">${clima.tempMin}°<span style="color:#2a3848 !important;font-size:10px;font-weight:400">/</span>${clima.tempMax}°</p>
                    <p style="margin:4px 0 0;font-size:8px;color:#2a3848 !important;font-family:'Courier New',monospace">mín / máx</p>
                  </td>
                  <!-- Humedad -->
                  <td width="25%" style="text-align:center;padding:0 8px;border-right:1px solid #141424">
                    <p style="margin:0 0 5px;font-size:7px;color:#2a3848 !important;text-transform:uppercase;letter-spacing:0.16em;font-family:'Courier New',monospace">💧 HUMEDAD</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:#7dd3fc !important;font-family:'Courier New',monospace">${clima.humedad}%</p>
                    <p style="margin:4px 0 0;font-size:8px;color:#2a3848 !important;font-family:'Courier New',monospace">${clima.humedad >= 80 ? 'Muy húmedo' : clima.humedad >= 60 ? 'Húmedo' : 'Normal'}</p>
                  </td>
                  <!-- Viento -->
                  <td width="25%" style="text-align:center;padding:0 8px;border-right:1px solid #141424">
                    <p style="margin:0 0 5px;font-size:7px;color:#2a3848 !important;text-transform:uppercase;letter-spacing:0.16em;font-family:'Courier New',monospace">💨 VIENTO</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:#94a3b8 !important;font-family:'Courier New',monospace">${clima.vientoKmh}<span style="font-size:9px;font-weight:400"> km/h</span></p>
                    <p style="margin:4px 0 0;font-size:8px;color:#2a3848 !important;font-family:'Courier New',monospace">${clima.vientoKmh >= 30 ? 'Ventoso' : clima.vientoKmh >= 15 ? 'Brisa mod.' : 'Brisa suave'}</p>
                  </td>
                  <!-- Prob. lluvia -->
                  <td width="25%" style="text-align:center;padding:0 0 0 8px">
                    <p style="margin:0 0 5px;font-size:7px;color:#2a3848 !important;text-transform:uppercase;letter-spacing:0.16em;font-family:'Courier New',monospace">☔ LLUVIA</p>
                    <p style="margin:0;font-size:14px;font-weight:700;color:${probColor} !important;font-family:'Courier New',monospace">${clima.probLluvia}%</p>
                    <p style="margin:4px 0 0;font-size:8px;color:#2a3848 !important;font-family:'Courier New',monospace">${clima.probLluvia >= 70 ? 'Muy probable' : clima.probLluvia >= 40 ? 'Probable' : clima.probLluvia >= 15 ? 'Baja prob.' : 'Poco prob.'}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- RAZÓN / ANÁLISIS -->
          <tr>
            <td bgcolor="${cfg.bg}" style="${cs()}padding:16px 22px;border-bottom:1px solid ${cfg.border}18">
              <p style="margin:0;font-size:12px;color:${cfg.textColor} !important;line-height:1.75;border-left:2px solid ${cfg.border};padding-left:14px;font-style:italic">${prediccion.razon}</p>
            </td>
          </tr>

          <!-- RECOMENDACIONES -->
          <tr>
            <td bgcolor="${cfg.bg}" style="${cs()}padding:18px 22px 22px">
              <p style="margin:0 0 12px;font-size:7px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#2a3848 !important;font-family:'Courier New',monospace">RECOMENDACIONES</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${bullets}
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>`;
}

// ─── Reporte HTML principal ──────────────────────────────────────────────────

function generarHtmlReporte(r: ReporteData): string {
  const FIRMA_URL =
    'https://firebasestorage.googleapis.com/v0/b/your-project-id.firebasestorage.app/o/logo.svg?alt=media';

  // ── Colores globales ──
  const PAGE_BG = '#040408';
  const EMAIL_BG = '#07070f';
  const CARD_BG = '#0b0b18';
  const SURF_BG = '#0f0f1e';
  const BORDER = '#161628';
  const BORDER2 = '#1a1a30';
  const GOLD = '#c9a227';
  const GOLD_DIM = '#7a5e18';
  const GOLD_TINT = '#0e0b02';
  const GOLD_BORD = '#2a1e04';
  const TEXT = '#eef0f8';
  const TEXT2 = '#7a8a9a';
  const TEXT3 = '#3a4858';
  const GREEN = '#059669';
  const GREEN_BG = '#020c06';
  const GREEN_BD = '#083d18';
  const RED = '#dc2626';
  const RED_BG = '#0e0202';
  const RED_BD = '#4a0808';
  const AMBER = '#d97706';
  const AMBER_BG = '#0e0800';
  const AMBER_BD = '#5a3800';

  // ── Tabla de locales ──
  const localesRows = Object.entries(r.ventas.porLocal)
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .map(([local, datos], i) => {
      const rowBg = i % 2 === 0 ? CARD_BG : SURF_BG;
      return `
      <tr>
        <td bgcolor="${rowBg}" style="background:${rowBg};background-color:${rowBg} !important;padding:11px 18px;border-bottom:1px solid ${BORDER};color:${TEXT} !important;font-size:12px;font-family:'Courier New',monospace;letter-spacing:0.03em">
          <span style="color:${TEXT3} !important;font-size:9px">${String(i + 1).padStart(2, '0')}</span>&nbsp;&nbsp;${local}
        </td>
        <td bgcolor="${rowBg}" style="background:${rowBg};background-color:${rowBg} !important;padding:11px 18px;border-bottom:1px solid ${BORDER};text-align:center;color:${TEXT2} !important;font-size:13px;font-family:'Courier New',monospace">${datos.ventas}</td>
        <td bgcolor="${rowBg}" style="background:${rowBg};background-color:${rowBg} !important;padding:11px 18px;border-bottom:1px solid ${BORDER};text-align:right;color:${GOLD} !important;font-weight:700;font-size:13px;font-family:'Courier New',monospace">${formatCOP(datos.ingresos)}</td>
      </tr>`;
    })
    .join('');

  // ── Alertas ──
  const alertas: string[] = [];
  if (r.ventas.preciosBajos > 0)
    alertas.push(
      `<strong style="color:${AMBER} !important">${r.ventas.preciosBajos} ventas</strong> registradas a precio por debajo del mínimo`,
    );
  if (r.pedidos.viejosRecibidos > 0)
    alertas.push(
      `<strong style="color:${AMBER} !important">${r.pedidos.viejosRecibidos} pedidos</strong> recibidos de días anteriores sin resolver`,
    );
  if (r.pedidos.devueltosViejos > 0)
    alertas.push(
      `<strong style="color:${AMBER} !important">${r.pedidos.devueltosViejos} devoluciones</strong> pendientes de aceptar en bodega`,
    );
  if (r.prestamos.criticos > 0)
    alertas.push(
      `<strong style="color:${AMBER} !important">${r.prestamos.criticos} préstamos</strong> con más de 7 días sin devolución`,
    );
  if (r.llegadas.tarde > 0)
    alertas.push(
      `<strong style="color:${AMBER} !important">${r.llegadas.tarde} trabajador${r.llegadas.tarde > 1 ? 'es' : ''}</strong> llegó tarde: ${r.llegadas.nombresTarde}`,
    );

  const alertasHtml =
    alertas.length > 0
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px">
      <tr>
        <td bgcolor="${AMBER_BG}" style="background:${AMBER_BG};background-color:${AMBER_BG} !important;border:1px solid ${AMBER_BD};border-left:3px solid ${AMBER};border-radius:0 10px 10px 0;padding:0;overflow:hidden">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td bgcolor="#0c0600" style="background:#0c0600;background-color:#0c0600 !important;padding:10px 18px;border-bottom:1px solid ${AMBER_BD}">
                <p style="margin:0;font-size:8px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${AMBER} !important;font-family:'Courier New',monospace">
                  ⚠ ALERTAS ACTIVAS · ${alertas.length} ITEM${alertas.length > 1 ? 'S' : ''}
                </p>
              </td>
            </tr>
            <tr>
              <td bgcolor="${AMBER_BG}" style="background:${AMBER_BG};background-color:${AMBER_BG} !important;padding:16px 20px">
                ${alertas
                  .map(
                    (a) => `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px">
                  <tr>
                    <td style="border-left:2px solid ${AMBER};padding-left:12px;font-size:12px;color:#9aacb8 !important;line-height:1.65">${a}</td>
                  </tr>
                </table>`,
                  )
                  .join('')}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`
      : `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px">
      <tr>
        <td bgcolor="${GREEN_BG}" style="background:${GREEN_BG};background-color:${GREEN_BG} !important;border:1px solid ${GREEN_BD};border-left:3px solid ${GREEN};border-radius:0 10px 10px 0;padding:14px 20px">
          <p style="margin:0;font-size:12px;color:#5ad8a8 !important;font-family:'Courier New',monospace;letter-spacing:0.04em">✓ SISTEMA OK — Sin alertas críticas. Operación dentro de parámetros normales.</p>
        </td>
      </tr>
    </table>`;

  // ── Tabla locales ──
  const tablaLocalesHtml =
    Object.keys(r.ventas.porLocal).length > 0
      ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px">
      <tr>
        <td>
          <p style="margin:0 0 14px;font-size:7px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${TEXT3} !important;font-family:'Courier New',monospace">── PERFORMANCE POR LOCAL ─────────────────────</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER2};border-radius:10px;overflow:hidden">
            <tr>
              <th bgcolor="${SURF_BG}" style="background:${SURF_BG};background-color:${SURF_BG} !important;padding:10px 18px;text-align:left;font-size:7px;color:${TEXT3} !important;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;font-family:'Courier New',monospace;border-bottom:1px solid ${BORDER2}"># LOCAL</th>
              <th bgcolor="${SURF_BG}" style="background:${SURF_BG};background-color:${SURF_BG} !important;padding:10px 18px;text-align:center;font-size:7px;color:${TEXT3} !important;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;font-family:'Courier New',monospace;border-bottom:1px solid ${BORDER2}">VENTAS</th>
              <th bgcolor="${SURF_BG}" style="background:${SURF_BG};background-color:${SURF_BG} !important;padding:10px 18px;text-align:right;font-size:7px;color:${TEXT3} !important;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;font-family:'Courier New',monospace;border-bottom:1px solid ${BORDER2}">INGRESOS</th>
            </tr>
            ${localesRows}
          </table>
        </td>
      </tr>
    </table>`
      : '';

  // ── Bodega ──
  const bodegaRatio =
    r.bodega.salidasHoy > 0
      ? Math.round((r.bodega.devolucionesHoy / r.bodega.salidasHoy) * 100)
      : 0;
  const ratioColor = bodegaRatio > 30 ? RED : bodegaRatio > 15 ? AMBER : GREEN;

  // Helper para mini-tarjeta bodega
  function miniCard(
    label: string,
    value: string | number,
    highlight = false,
  ): string {
    const bg = highlight ? RED_BG : CARD_BG;
    const bd = highlight ? RED_BD : BORDER;
    const col = highlight ? RED : TEXT;
    return `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td bgcolor="${bg}" style="background:${bg};background-color:${bg} !important;border:1px solid ${bd};border-radius:8px;padding:14px 16px">
          <p style="margin:0 0 4px;font-size:7px;color:${TEXT3} !important;text-transform:uppercase;letter-spacing:0.14em;font-family:'Courier New',monospace">${label}</p>
          <p style="margin:0;font-size:26px;font-weight:800;color:${col} !important;letter-spacing:-0.03em;font-family:'Courier New',monospace">${value}</p>
        </td>
      </tr>
    </table>`;
  }

  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:dark">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="dark only"/>
  <meta name="supported-color-schemes" content="dark only"/>
  <title>Reporte ShoeShop</title>
  <style>
    :root { color-scheme: dark only !important; }
    html, body, #__body, #__body_table {
      background-color: ${PAGE_BG} !important;
      background: ${PAGE_BG} !important;
      color: ${TEXT} !important;
    }
    [data-ogsc] #__body,
    [data-ogsb] #__body { background-color: ${PAGE_BG} !important; }
    p, h1, h2, span, td, th, strong, a { color: inherit !important; }
  </style>
</head>
<body id="__body" style="margin:0;padding:0;background:${PAGE_BG};background-color:${PAGE_BG} !important;color:${TEXT} !important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif">

<table id="__body_table" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};background-color:${PAGE_BG} !important">
  <tr>
    <td align="center" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};background-color:${PAGE_BG} !important;padding:48px 16px 72px">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%">

        <!-- ═══ HEADER ═══════════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="${EMAIL_BG}" style="background:${EMAIL_BG};background-color:${EMAIL_BG} !important;border-radius:14px 14px 0 0;padding:0;border-top:1px solid ${GOLD_BORD};border-left:1px solid ${GOLD_BORD};border-right:1px solid ${GOLD_BORD};overflow:hidden">

            <!-- Línea dorada superior -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td bgcolor="${GOLD}" style="background:${GOLD};background-color:${GOLD} !important;height:3px;font-size:0;line-height:0"> </td>
              </tr>
            </table>

            <!-- Contenido header -->
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 40px 28px">
              <tr>
                <td style="vertical-align:middle">
                  <p style="margin:0 0 8px;font-size:8px;font-weight:700;letter-spacing:0.34em;text-transform:uppercase;color:${GOLD} !important;font-family:'Courier New',monospace">SHOESHOP · INTELLIGENCE SYSTEM</p>
                  <h1 style="margin:0 0 2px;font-size:30px;font-weight:800;color:${TEXT} !important;letter-spacing:-0.04em;line-height:1.05">REPORTE DIARIO</h1>
                  <p style="margin:10px 0 0;font-size:11px;color:${TEXT3} !important;font-family:'Courier New',monospace;letter-spacing:0.1em">${r.fecha.toUpperCase()}</p>
                </td>
                <td align="right" style="vertical-align:middle;width:72px">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="${GOLD_TINT}" style="background:${GOLD_TINT};background-color:${GOLD_TINT} !important;width:58px;height:58px;border:1px solid ${GOLD_DIM};border-radius:12px;text-align:center;vertical-align:middle;font-size:26px;line-height:58px">📊</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Divisor header -->
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 40px">
              <tr>
                <td bgcolor="${GOLD_BORD}" style="background:${GOLD_BORD};background-color:${GOLD_BORD} !important;height:1px;font-size:0;line-height:0"> </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══ BODY ══════════════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="${EMAIL_BG}" style="background:${EMAIL_BG};background-color:${EMAIL_BG} !important;padding:36px 40px;border-left:1px solid ${GOLD_BORD};border-right:1px solid ${GOLD_BORD}">

            ${alertasHtml}

            ${generarBloqueClima(r.clima ?? null, r.prediccion ?? null)}

            <!-- ─── VENTAS DEL DÍA ─────────────────────────────────────────── -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px">
              <tr>
                <td colspan="2" style="padding-bottom:14px">
                  <p style="margin:0;font-size:7px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${TEXT3} !important;font-family:'Courier New',monospace">── VENTAS DEL DÍA ──────────────────────────────</p>
                </td>
              </tr>
              <tr>
                <!-- Total ventas -->
                <td width="50%" style="padding-right:8px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="${CARD_BG}" style="background:${CARD_BG};background-color:${CARD_BG} !important;border:1px solid ${BORDER2};border-radius:10px;padding:20px 22px">
                        <p style="margin:0 0 5px;font-size:7px;color:${TEXT3} !important;text-transform:uppercase;letter-spacing:0.18em;font-family:'Courier New',monospace">TOTAL VENTAS</p>
                        <p style="margin:0;font-size:38px;font-weight:800;color:${TEXT} !important;letter-spacing:-0.04em;line-height:1">${r.ventas.total}</p>
                        <p style="margin:6px 0 0;font-size:10px;color:${TEXT3} !important;font-family:'Courier New',monospace">${r.ventas.total > 10 ? 'Jornada activa' : r.ventas.total > 5 ? 'Jornada regular' : 'Jornada tranquila'}</p>
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Ingresos -->
                <td width="50%" style="padding-left:8px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="${GOLD_TINT}" style="background:${GOLD_TINT};background-color:${GOLD_TINT} !important;border:1px solid ${GOLD_BORD};border-radius:10px;padding:20px 22px">
                        <p style="margin:0 0 5px;font-size:7px;color:${GOLD_DIM} !important;text-transform:uppercase;letter-spacing:0.18em;font-family:'Courier New',monospace">INGRESOS</p>
                        <p style="margin:0;font-size:22px;font-weight:800;color:${GOLD} !important;letter-spacing:-0.02em;font-family:'Courier New',monospace;line-height:1.1">${formatCOP(r.ventas.ingresoTotal)}</p>
                        ${
                          r.ventas.total > 0
                            ? `<p style="margin:6px 0 0;font-size:10px;color:${GOLD_DIM} !important;font-family:'Courier New',monospace">≈ ${formatCOP(Math.round(r.ventas.ingresoTotal / r.ventas.total))} / venta</p>`
                            : ''
                        }
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- TOP PERFORMER -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px">
              <tr>
                <td bgcolor="${GOLD_TINT}" style="background:${GOLD_TINT};background-color:${GOLD_TINT} !important;border:1px solid ${GOLD_BORD};border-left:3px solid ${GOLD};border-radius:0 8px 8px 0;padding:12px 18px">
                  <p style="margin:0;font-size:11px;color:${TEXT2} !important;font-family:'Courier New',monospace">
                    <span style="color:${GOLD} !important;font-weight:700;letter-spacing:0.06em">▲ TOP PERFORMER</span>&nbsp;&nbsp;·&nbsp;&nbsp;${r.ventas.lider}
                  </p>
                </td>
              </tr>
            </table>

            ${tablaLocalesHtml}

            <!-- ─── MOVIMIENTOS DE BODEGA ──────────────────────────────────── -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px">
              <tr>
                <td colspan="2" style="padding-bottom:14px">
                  <p style="margin:0;font-size:7px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${TEXT3} !important;font-family:'Courier New',monospace">── MOVIMIENTOS DE BODEGA ───────────────────────</p>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 8px 10px 0">${miniCard('PEDIDOS DESPACHADOS', r.bodega.pedidosHoy)}</td>
                <td width="50%" style="padding:0 0 10px 8px">${miniCard('EXHIBICIONES ENV.', r.bodega.exhibHoy)}</td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 8px 0 0">${miniCard('DEVOLUCIONES ACEPT.', r.bodega.devolucionesHoy)}</td>
                <td width="50%" style="padding:0 0 0 8px">${miniCard('EXHIB. PENDIENTES', r.bodega.exhibicionesPendientes, r.bodega.exhibicionesPendientes > 0)}</td>
              </tr>
              <!-- Pares netos -->
              <tr>
                <td colspan="2" style="padding-top:10px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="#030a12" style="background:#030a12;background-color:#030a12 !important;border:1px solid #0c2030;border-radius:8px;padding:12px 18px">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td>
                              <p style="margin:0;font-size:12px;color:#5a8ab8 !important;font-family:'Courier New',monospace;letter-spacing:0.02em">
                                PARES NETOS FUERA: <strong style="color:#7aaed8 !important;font-size:15px">${r.bodega.paresNetos}</strong>
                                <span style="color:${TEXT3} !important;font-size:10px">&nbsp;(${r.bodega.salidasHoy} salidas – ${r.bodega.devolucionesHoy} dev.)</span>
                              </p>
                            </td>
                            <td align="right" style="width:80px">
                              <p style="margin:0;font-size:11px;font-weight:700;color:${ratioColor} !important;font-family:'Courier New',monospace">${bodegaRatio}% dev.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ─── ESTADO DE OPERACIONES ──────────────────────────────────── -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px">
              <tr>
                <td colspan="2" style="padding-bottom:14px">
                  <p style="margin:0;font-size:7px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${TEXT3} !important;font-family:'Courier New',monospace">── ESTADO DE OPERACIONES ───────────────────────</p>
                </td>
              </tr>
              <tr>
                <!-- Pedidos -->
                <td width="50%" style="padding-right:8px;vertical-align:top">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="${CARD_BG}" style="background:${CARD_BG};background-color:${CARD_BG} !important;border:1px solid ${BORDER2};border-radius:10px;padding:20px 22px">
                        <p style="margin:0 0 16px;font-size:7px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${TEXT3} !important;font-family:'Courier New',monospace">PEDIDOS</p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:11px;color:${TEXT3} !important;padding-bottom:10px;font-family:'Courier New',monospace">Pendientes</td>
                            <td align="right" style="font-size:18px;font-weight:700;color:${TEXT} !important;padding-bottom:10px;font-family:'Courier New',monospace">${r.pedidos.pendientes}</td>
                          </tr>
                          <tr>
                            <td style="font-size:11px;color:${TEXT3} !important;padding-bottom:10px;font-family:'Courier New',monospace">Recibidos</td>
                            <td align="right" style="font-size:18px;font-weight:700;color:${TEXT} !important;padding-bottom:10px;font-family:'Courier New',monospace">${r.pedidos.recibidos}</td>
                          </tr>
                          <tr>
                            <td style="font-size:11px;color:${TEXT3} !important;font-family:'Courier New',monospace">Devueltos</td>
                            <td align="right" style="font-size:18px;font-weight:700;color:${TEXT} !important;font-family:'Courier New',monospace">${r.pedidos.devueltos}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
                <!-- Préstamos -->
                <td width="50%" style="padding-left:8px;vertical-align:top">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td bgcolor="${CARD_BG}" style="background:${CARD_BG};background-color:${CARD_BG} !important;border:1px solid ${BORDER2};border-radius:10px;padding:20px 22px">
                        <p style="margin:0 0 16px;font-size:7px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${TEXT3} !important;font-family:'Courier New',monospace">PRÉSTAMOS</p>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size:11px;color:${TEXT3} !important;padding-bottom:10px;font-family:'Courier New',monospace">Activos</td>
                            <td align="right" style="font-size:18px;font-weight:700;color:${TEXT} !important;padding-bottom:10px;font-family:'Courier New',monospace">${r.prestamos.total}</td>
                          </tr>
                          <tr>
                            <td style="font-size:11px;color:${TEXT3} !important;font-family:'Courier New',monospace">Críticos +7d</td>
                            <td align="right" style="font-size:18px;font-weight:700;color:${r.prestamos.criticos > 0 ? RED : TEXT} !important;font-family:'Courier New',monospace">${r.prestamos.criticos}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- ─── REGISTRO DE LLEGADAS ───────────────────────────────────── -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:14px">
                  <p style="margin:0;font-size:7px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:${TEXT3} !important;font-family:'Courier New',monospace">── REGISTRO DE LLEGADAS · ${r.llegadas.total} ENTRADAS ──────</p>
                </td>
              </tr>
              <tr>
                <td bgcolor="${r.llegadas.tarde > 0 ? RED_BG : GREEN_BG}" style="background:${r.llegadas.tarde > 0 ? RED_BG : GREEN_BG};background-color:${r.llegadas.tarde > 0 ? RED_BG : GREEN_BG} !important;border:1px solid ${r.llegadas.tarde > 0 ? RED_BD : GREEN_BD};border-left:3px solid ${r.llegadas.tarde > 0 ? RED : GREEN};border-radius:0 10px 10px 0;padding:16px 20px">
                  ${
                    r.llegadas.tarde === 0
                      ? `<p style="margin:0;font-size:12px;color:#5ad8a8 !important;font-family:'Courier New',monospace;letter-spacing:0.04em">✓ TODOS PUNTUALES — Sin incidencias de puntualidad.</p>`
                      : `<p style="margin:0;font-size:12px;color:#f0a0a0 !important;font-family:'Courier New',monospace">✗ TARDE (${r.llegadas.tarde}): <strong style="color:${RED} !important">${r.llegadas.nombresTarde}</strong></p>`
                  }
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ═══ FOOTER / FIRMA ════════════════════════════════════════════════ -->
        <tr>
          <td bgcolor="${EMAIL_BG}" style="background:${EMAIL_BG};background-color:${EMAIL_BG} !important;border-radius:0 0 14px 14px;border-bottom:1px solid ${GOLD_BORD};border-left:1px solid ${GOLD_BORD};border-right:1px solid ${GOLD_BORD};padding:0;overflow:hidden">

            <!-- Línea dorada inferior -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td bgcolor="${GOLD_BORD}" style="background:${GOLD_BORD};background-color:${GOLD_BORD} !important;height:1px;font-size:0;line-height:0"> </td>
              </tr>
            </table>

            <!-- Imagen firma -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${EMAIL_BG}" style="background:${EMAIL_BG};background-color:${EMAIL_BG} !important;padding:28px 0 0">
                  <img src="${FIRMA_URL}" alt="ShoeShop" width="560" style="width:100%;max-width:560px;height:auto;display:block;border:0;margin:0 auto"/>
                </td>
              </tr>
            </table>

            <!-- Taglines footer -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" bgcolor="${EMAIL_BG}" style="background:${EMAIL_BG};background-color:${EMAIL_BG} !important;padding:16px 40px 32px">
                  <p style="margin:0;font-size:8px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${GOLD} !important;font-family:'Courier New',monospace">INTELLIGENCE SYSTEM · AUTOMATIZADO</p>
                  <p style="margin:5px 0 0;font-size:9px;color:${TEXT3} !important;letter-spacing:0.08em;font-family:'Courier New',monospace">Generado por IA · ShoeShop © 2026</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Espaciado inferior -->
        <tr>
          <td bgcolor="${PAGE_BG}" style="background:${PAGE_BG};background-color:${PAGE_BG} !important;height:40px"> </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}
