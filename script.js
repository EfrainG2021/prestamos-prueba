// ⚠️ En producción, este token debe ir en backend (no en el frontend)
const API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Inhpb21hcmF2ZXJhcGVyZXoyNkBnbWFpbC5jb20ifQ.4xtw1x9_oL0eTFr3M50L-gUlFZMDL_eB2mFhmCUWo4E";
const BASE_URL = "https://dniruc.apisperu.com/api/v1";

let clienteVerificado = null;
let prestamosRegistrados = [];
let tipoConsulta = 'dni';
let prestamoActualParaCronograma = null;

// ---------------------------
// Inicialización
// ---------------------------
document.addEventListener('DOMContentLoaded', function() {
  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];
  const fechaInicio = document.getElementById('fechaInicio');
  fechaInicio.value = todayISO;
  fechaInicio.min = todayISO;

  // Cargar préstamos persistidos
  const prestamosGuardados = localStorage.getItem("prestamosRegistrados");
  if (prestamosGuardados) {
    prestamosRegistrados = JSON.parse(prestamosGuardados);
  }

  actualizarListaPrestamos();
  actualizarCalculos();
});

// Persistencia
function guardarPrestamos() {
  localStorage.setItem("prestamosRegistrados", JSON.stringify(prestamosRegistrados));
}

// Borrar datos locales
function borrarDatosLocales() {
  const total = prestamosRegistrados.length;
  if (total === 0) {
    mostrarNotificacion("No hay datos para borrar.", "info");
    return;
  }
  const ok = confirm(`Esto eliminará ${total} préstamo(s) guardado(s) en este navegador. ¿Deseas continuar?`);
  if (!ok) return;

  try {
    localStorage.removeItem("prestamosRegistrados");
    prestamosRegistrados = [];
    actualizarListaPrestamos();
    mostrarNotificacion("Datos locales eliminados correctamente.", "success");
  } catch (e) {
    mostrarNotificacion("No se pudieron borrar los datos locales.", "error");
  }
}

// ---------------------------
// UI Helpers
// ---------------------------
function cambiarTipoConsulta(tipo) {
  tipoConsulta = tipo;
  document.getElementById('btnDni').classList.toggle('active', tipo === 'dni');
  document.getElementById('btnRuc').classList.toggle('active', tipo === 'ruc');
  document.getElementById('dniSection').classList.toggle('hidden', tipo !== 'dni');
  document.getElementById('rucSection').classList.toggle('hidden', tipo !== 'ruc');
  if (tipo === 'dni') document.getElementById('dni').value = '';
  else document.getElementById('ruc').value = '';
  limpiarResultadoVerificacion();
}

function mostrarNotificacion(mensaje, tipo) {
  const notification = document.getElementById('notification');
  notification.textContent = mensaje;
  notification.className = `notification ${tipo}`;
  notification.classList.remove('hidden');
  setTimeout(() => notification.classList.add('hidden'), 5000);
}

function mostrarCargando(mostrar) {
  const btnText = document.getElementById('btnText');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const btnVerificar = document.getElementById('btnVerificar');
  if (mostrar) {
    btnText.classList.add('hidden');
    loadingSpinner.classList.remove('hidden');
    btnVerificar.disabled = true;
  } else {
    btnText.classList.remove('hidden');
    loadingSpinner.classList.add('hidden');
    btnVerificar.disabled = false;
  }
}

// ---------------------------
// Consultas RENIEC/SUNAT
// ---------------------------
async function verificarCliente() {
  const valor = (tipoConsulta === 'dni'
    ? document.getElementById('dni').value.trim()
    : document.getElementById('ruc').value.trim());

  if (!valor) {
    mostrarNotificacion(`Por favor ingrese un ${tipoConsulta.toUpperCase()} válido`, 'error');
    return;
  }
  if (tipoConsulta === 'dni' && (valor.length !== 8 || isNaN(valor))) {
    mostrarNotificacion('Por favor ingrese un DNI válido de 8 dígitos', 'error');
    return;
  }
  if (tipoConsulta === 'ruc' && (valor.length !== 11 || isNaN(valor))) {
    mostrarNotificacion('Por favor ingrese un RUC válido de 11 dígitos', 'error');
    return;
  }

  mostrarCargando(true);
  mostrarNotificacion('Consultando con RENIEC/SUNAT...', 'info');

  try {
    const url = `${BASE_URL}/${tipoConsulta}/${valor}?token=${API_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    if (tipoConsulta === 'dni') {
      clienteVerificado = {
        nombre: `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`,
        documento: data.dni,
        tipo: 'Persona Natural',
        direccion: data.direccion || 'No disponible',
        estado: 'Activo'
      };
    } else {
      clienteVerificado = {
        nombre: data.razonSocial,
        documento: data.ruc,
        tipo: data.tipo === 'NATURAL' ? 'Persona Natural' : 'Persona Jurídica',
        direccion: data.direccion || 'No disponible',
        estado: data.estado || 'Activo'
      };
    }

    mostrarResultadoVerificacion();
    mostrarNotificacion('Cliente verificado exitosamente', 'success');
  } catch (error) {
    clienteVerificado = null;
    limpiarResultadoVerificacion();
    mostrarNotificacion(`Error al consultar: ${error.message}`, 'error');
  } finally {
    mostrarCargando(false);
  }
}

function mostrarResultadoVerificacion() {
  if (!clienteVerificado) return;
  document.getElementById('nombreCliente').textContent = clienteVerificado.nombre;
  document.getElementById('documentoCliente').textContent = clienteVerificado.documento;
  document.getElementById('tipoCliente').textContent = clienteVerificado.tipo;
  document.getElementById('direccionCliente').textContent = clienteVerificado.direccion;
  document.getElementById('estadoCliente').textContent = clienteVerificado.estado;

  document.getElementById('customerInfo').classList.remove('hidden');
  document.getElementById('btnRegistrar').disabled = false;
}

function limpiarResultadoVerificacion() {
  clienteVerificado = null;
  document.getElementById('customerInfo').classList.add('hidden');
  document.getElementById('btnRegistrar').disabled = true;
}

// ---------------------------
// Utilidades de fechas y cálculo
// ---------------------------
function sumarMeses(fechaISO, meses) {
  const fecha = new Date(fechaISO + 'T00:00:00');
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString().split('T')[0];
}

function formatearFechaParaMostrar(fechaISO) {
  const [y, m, d] = fechaISO.split('-');
  return `${d}/${m}/${y}`;
}

function formatearFechaParaTabla(fechaISO) {
  const [y, m, d] = fechaISO.split('-');
  return `${d}/${m}/${y}`;
}

function formatearFechaParaCronograma(fechaISO) {
  const fecha = new Date(fechaISO + 'T00:00:00');
  const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
  return fecha.toLocaleDateString('es-PE', opciones);
}

function calcularCuotaFija(monto, tasaInteresAnual, plazoMeses) {
  const tasaMensual = tasaInteresAnual / 100 / 12;
  if (tasaMensual === 0) return monto / plazoMeses;
  return monto * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) / (Math.pow(1 + tasaMensual, plazoMeses) - 1);
}

function actualizarCalculos() {
  const montoInput = document.getElementById('monto').value;
  const interesInput = document.getElementById('interes').value;
  const plazoInput = document.getElementById('plazo').value;
  const fechaInicioInput = document.getElementById('fechaInicio').value;

  if (montoInput && interesInput && plazoInput && fechaInicioInput) {
    const monto = parseFloat(montoInput);
    const interes = parseFloat(interesInput);
    const plazo = parseInt(plazoInput);
    const fechaDesembolsoISO = fechaInicioInput;

    if (monto <= 0 || interes < 0 || plazo <= 0) {
      document.getElementById('interesCalculado').classList.add('hidden');
      document.getElementById('fechaCalculada').classList.add('hidden');
      document.getElementById('primeraCuota').classList.add('hidden');
      return;
    }

    const cuotaFija = calcularCuotaFija(monto, interes, plazo);
    const montoTotal = cuotaFija * plazo;
    const interesTotal = montoTotal - monto;

    const fechaPrimeraCuotaISO = sumarMeses(fechaDesembolsoISO, 1);
    const fechaUltimaCuotaISO = sumarMeses(fechaDesembolsoISO, plazo);

    document.getElementById('montoPrestado').textContent = `S/ ${monto.toFixed(2)}`;
    document.getElementById('tasaInteres').textContent = `${interes}%`;
    document.getElementById('interesTotal').textContent = `S/ ${interesTotal.toFixed(2)}`;
    document.getElementById('montoTotalPagar').textContent = `S/ ${montoTotal.toFixed(2)}`;

    document.getElementById('fechaDesembolsoMostrada').textContent = formatearFechaParaMostrar(fechaDesembolsoISO);
    document.getElementById('fechaPrimeraCuotaMostrada').textContent = formatearFechaParaMostrar(fechaPrimeraCuotaISO);
    document.getElementById('fechaUltimaCuotaMostrada').textContent = formatearFechaParaMostrar(fechaUltimaCuotaISO);

    document.getElementById('fechaPrimeraCuota').textContent = formatearFechaParaCronograma(fechaPrimeraCuotaISO);
    document.getElementById('montoPrimeraCuota').textContent = `S/ ${cuotaFija.toFixed(2)}`;

    document.getElementById('interesCalculado').classList.remove('hidden');
    document.getElementById('fechaCalculada').classList.remove('hidden');
    document.getElementById('primeraCuota').classList.remove('hidden');
  } else {
    document.getElementById('interesCalculado').classList.add('hidden');
    document.getElementById('fechaCalculada').classList.add('hidden');
    document.getElementById('primeraCuota').classList.add('hidden');
  }
}

// Eventos para cálculos en vivo
document.getElementById('monto').addEventListener('input', actualizarCalculos);
document.getElementById('interes').addEventListener('input', actualizarCalculos);
document.getElementById('plazo').addEventListener('input', actualizarCalculos);
document.getElementById('fechaInicio').addEventListener('change', actualizarCalculos);

// ---------------------------
// Registro de préstamo
// ---------------------------
function registrarPrestamo() {
  if (!clienteVerificado) {
    mostrarNotificacion('Primero debe verificar al cliente', 'error');
    return;
  }

  const monto = parseFloat(document.getElementById('monto').value);
  const interes = parseFloat(document.getElementById('interes').value);
  const plazo = parseInt(document.getElementById('plazo').value);
  const fechaDesembolsoISO = document.getElementById('fechaInicio').value;

  if (isNaN(monto) || monto <= 0) { mostrarNotificacion('Ingrese un monto válido mayor a 0', 'error'); return; }
  if (isNaN(interes) || interes < 0) { mostrarNotificacion('Ingrese una tasa de interés válida', 'error'); return; }
  if (isNaN(plazo) || plazo <= 0) { mostrarNotificacion('Ingrese un plazo válido mayor a 0', 'error'); return; }
  if (!fechaDesembolsoISO) { mostrarNotificacion('Seleccione una fecha de desembolso', 'error'); return; }

  const hoy = new Date();
  const fechaSel = new Date(fechaDesembolsoISO + 'T00:00:00');
  if (fechaSel < hoy.setHours(0,0,0,0)) {
    mostrarNotificacion('La fecha de desembolso no puede ser anterior a hoy', 'error'); return;
  }

  const cuotaFija = calcularCuotaFija(monto, interes, plazo);
  const montoTotal = cuotaFija * plazo;
  const interesTotal = montoTotal - monto;
  const fechaPrimeraCuotaISO = sumarMeses(fechaDesembolsoISO, 1);
  const fechaUltimaCuotaISO = sumarMeses(fechaDesembolsoISO, plazo);

  const prestamo = {
    id: Date.now(),
    cliente: clienteVerificado.nombre,
    documento: clienteVerificado.documento,
    fechaRegistro: new Date().toLocaleDateString('es-PE'),
    fechaDesembolso: fechaDesembolsoISO,
    fechaPrimeraCuota: fechaPrimeraCuotaISO,
    fechaUltimaCuota: fechaUltimaCuotaISO,
    monto, interes, interesTotal, plazo,
    cuotaMensual: cuotaFija,
    montoTotal
  };

  prestamosRegistrados.push(prestamo);
  guardarPrestamos();
  actualizarListaPrestamos();
  limpiarFormularioPrestamo();
  mostrarNotificacion('Préstamo registrado exitosamente', 'success');
}

// ---------------------------
// Cronograma (modal + impresión)
// ---------------------------
function generarCronogramaEnModal(prestamo) {
  const cronogramaBody = document.getElementById('cronogramaBodyModal');
  cronogramaBody.innerHTML = '';

  document.getElementById('cronogramaClienteModal').textContent = prestamo.cliente;
  document.getElementById('cronogramaDocumentoModal').textContent = `Documento: ${prestamo.documento}`;
  document.getElementById('cronogramaDetallesModal').textContent =
    `Monto: S/ ${prestamo.monto.toFixed(2)} | Tasa: ${prestamo.interes}% | Plazo: ${prestamo.plazo} meses`;

  const cuotaFija = prestamo.cuotaMensual;
  let saldoRestante = prestamo.monto;
  let totalAmortizacion = 0;
  let totalInteres = 0;

  for (let i = 1; i <= prestamo.plazo; i++) {
    const fechaPagoISO = sumarMeses(prestamo.fechaDesembolso, i);
    const fechaFormateada = formatearFechaParaTabla(fechaPagoISO);
    const tasaMensual = prestamo.interes / 100 / 12;
    const interesCuota = saldoRestante * tasaMensual;
    let amortizacionCuota = cuotaFija - interesCuota;
    let cuota = cuotaFija;

    if (i === prestamo.plazo) {
      amortizacionCuota = saldoRestante;
      cuota = amortizacionCuota + interesCuota;
      saldoRestante = 0;
    } else {
      saldoRestante -= amortizacionCuota;
    }

    totalAmortizacion += amortizacionCuota;
    totalInteres += interesCuota;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${i}</td>
      <td>${fechaFormateada}</td>
      <td>S/ ${amortizacionCuota.toFixed(2)}</td>
      <td>S/ ${interesCuota.toFixed(2)}</td>
      <td>S/ ${cuota.toFixed(2)}</td>
      <td>S/ ${saldoRestante.toFixed(2)}</td>
    `;
    cronogramaBody.appendChild(row);
  }

  document.getElementById('totalAmortizacionModal').textContent = `S/ ${totalAmortizacion.toFixed(2)}`;
  document.getElementById('totalInteresModal').textContent = `S/ ${totalInteres.toFixed(2)}`;
  document.getElementById('totalCuotaModal').textContent = `S/ ${(totalAmortizacion + totalInteres).toFixed(2)}`;
  document.getElementById('saldoFinalModal').textContent = `S/ ${saldoRestante.toFixed(2)}`;

  prestamoActualParaCronograma = prestamo;
}

function abrirModalCronograma(prestamoId) {
  const prestamo = prestamosRegistrados.find(p => p.id === prestamoId);
  if (prestamo) {
    generarCronogramaEnModal(prestamo);
    document.getElementById('cronogramaModal').style.display = 'block';
  }
}

function cerrarModalCronograma() {
  document.getElementById('cronogramaModal').style.display = 'none';
  prestamoActualParaCronograma = null;
}

// Imprimir (permite guardar como PDF)
function imprimirCronogramaActual() {
  if (!prestamoActualParaCronograma) return;

  const p = prestamoActualParaCronograma;
  const printWindow = window.open('', '_blank');
  const html = generarHTMLCronograma(p);

  printWindow.document.write(html);
  printWindow.document.close();
  // Pequeño delay para asegurar carga antes de imprimir
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

// ---------------------------
// Compartir / Descargar PDF (sin librerías externas)
// Abre una pestaña con el HTML del cronograma para que el usuario use "Guardar como PDF".
// En móviles, además intenta usar Web Share con la URL (si está soportado).
// ---------------------------
async function compartirCronogramaPDF() {
  if (!prestamoActualParaCronograma) {
    mostrarNotificacion("Abre un cronograma antes de compartir.", "error");
    return;
  }
  const p = prestamoActualParaCronograma;
  const html = generarHTMLCronograma(p);

  // Crear un Blob de HTML y abrir en una nueva pestaña
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');

  // Intento de compartir URL (soportado en algunos navegadores móviles)
  try {
    if (navigator.share && typeof navigator.share === 'function') {
      await navigator.share({
        title: 'Cronograma de Pagos',
        text: `Cronograma de ${p.cliente} (${p.documento}). Abre y guarda como PDF.`,
        url
      });
      mostrarNotificacion("Enlace compartido. Abre y guarda como PDF.", "success");
    } else {
      mostrarNotificacion("Abierto en nueva pestaña. Usa 'Guardar como PDF' o compártelo.", "info");
    }
  } catch (_) {
    mostrarNotificacion("Abierto en nueva pestaña. Usa 'Guardar como PDF' o compártelo.", "info");
  }
}

// HTML reutilizable para impresión/compartir
function generarHTMLCronograma(p) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Cronograma de Pagos</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .info { text-align: center; margin-bottom: 20px; padding: 15px; background: #f0f0f0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #000; padding: 10px; text-align: center; }
        th { background: #667eea; color: white; font-weight: bold; text-transform: uppercase; }
        .total { font-weight: bold; background: #e8f5e8; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; }
        @page { size: A4; margin: 18mm; }
      </style>
    </head>
    <body>
      <div class="header"><h2>CRONOGRAMA DE PAGOS</h2></div>
      <div class="info">
        <h3>${p.cliente}</h3>
        <p>Documento: ${p.documento}</p>
        <p>Monto: S/ ${p.monto.toFixed(2)} | Tasa: ${p.interes}% | Plazo: ${p.plazo} meses</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>MES</th><th>VENCIMIENTO</th><th>AMORTIZACIÓN</th><th>INTERÉS</th><th>CUOTA</th><th>SALDO</th>
          </tr>
        </thead>
        <tbody>
          ${(() => {
            let rows = '';
            let saldo = p.monto;
            const tasaMensual = p.interes / 100 / 12;
            for (let i = 1; i <= p.plazo; i++) {
              const fechaPagoISO = sumarMeses(p.fechaDesembolso, i);
              const fechaTab = formatearFechaParaTabla(fechaPagoISO);
              const interesCuota = saldo * tasaMensual;
              let amort = p.cuotaMensual - interesCuota;
              let cuota = p.cuotaMensual;
              if (i === p.plazo) { amort = saldo; cuota = amort + interesCuota; }
              saldo -= amort;
              rows += `<tr>
                <td>${i}</td>
                <td>${fechaTab}</td>
                <td>S/ ${amort.toFixed(2)}</td>
                <td>S/ ${interesCuota.toFixed(2)}</td>
                <td>S/ ${cuota.toFixed(2)}</td>
                <td>S/ ${saldo.toFixed(2)}</td>
              </tr>`;
            }
            return rows;
          })()}
        </tbody>
        <tfoot>
          <tr class="total">
            <td colspan="2" style="text-align:right;padding-right:10px;">TOTAL:</td>
            <td>S/ ${p.monto.toFixed(2)}</td>
            <td>S/ ${p.interesTotal.toFixed(2)}</td>
            <td>S/ ${p.montoTotal.toFixed(2)}</td>
            <td>S/ 0.00</td>
          </tr>
        </tfoot>
      </table>
      <div class="footer"><p>Documento generado automáticamente por el sistema de préstamos</p></div>
      <script>
        // Auto-abrir diálogo de impresión en la pestaña compartida si el usuario lo desea:
        setTimeout(() => { if (window.print) window.print(); }, 400);
      <\/script>
    </body>
    </html>
  `;
}

// ---------------------------
// Lista y limpieza de formulario
// ---------------------------
function actualizarListaPrestamos() {
  const loansList = document.getElementById('loansList');
  const totalPrestamos = document.getElementById('totalPrestamos');
  totalPrestamos.textContent = prestamosRegistrados.length;

  if (prestamosRegistrados.length === 0) {
    loansList.innerHTML = '<p id="noLoans">No hay préstamos registrados aún.</p>';
    return;
  }

  const prestamosOrdenados = [...prestamosRegistrados].sort((a, b) =>
    new Date(b.fechaDesembolso) - new Date(a.fechaDesembolso)
  );

  let html = '';
  prestamosOrdenados.forEach(prestamo => {
    html += `
      <div class="loan-item">
        <button class="generate-btn" onclick="abrirModalCronograma(${prestamo.id})">Generar Cronograma</button>
        <h4>${prestamo.cliente}</h4>
        <div class="loan-details">
          <div><strong>Registro:</strong> ${prestamo.fechaRegistro}</div>
          <div><strong>Doc:</strong> ${prestamo.documento}</div>
          <div><strong>Desembolso:</strong> ${formatearFechaParaMostrar(prestamo.fechaDesembolso)}</div>
          <div><strong>Primera Cuota:</strong> ${formatearFechaParaMostrar(prestamo.fechaPrimeraCuota)}</div>
          <div><strong>Última Cuota:</strong> ${formatearFechaParaMostrar(prestamo.fechaUltimaCuota)}</div>
          <div><strong>Monto:</strong> S/ ${prestamo.monto.toFixed(2)}</div>
          <div><strong>Interés:</strong> ${prestamo.interes}%</div>
          <div><strong>Interés Total:</strong> S/ ${prestamo.interesTotal.toFixed(2)}</div>
          <div><strong>Cuota:</strong> S/ ${prestamo.cuotaMensual.toFixed(2)}</div>
          <div><strong>Plazo:</strong> ${prestamo.plazo} meses</div>
          <div><strong>Total:</strong> S/ ${prestamo.montoTotal.toFixed(2)}</div>
        </div>
      </div>
    `;
  });

  loansList.innerHTML = html;
}

function limpiarFormularioPrestamo() {
  document.getElementById('monto').value = '';
  document.getElementById('interes').value = '5';
  document.getElementById('plazo').value = '12';
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('fechaInicio').value = today;
  document.getElementById('interesCalculado').classList.add('hidden');
  document.getElementById('fechaCalculada').classList.add('hidden');
  document.getElementById('primeraCuota').classList.add('hidden');
}

// Cerrar modal al hacer clic fuera
window.onclick = function(event) {
  const modal = document.getElementById('cronogramaModal');
  if (event.target === modal) cerrarModalCronograma();
};

// Inicial
actualizarListaPrestamos();
