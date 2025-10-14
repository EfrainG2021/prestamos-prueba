// ⚠️ En producción, mueve este token al backend.
const API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Inhpb21hcmF2ZXJhcGVyZXoyNkBnbWFpbC5jb20ifQ.4xtw1x9_oL0eTFr3M50L-gUlFZMDL_eB2mFhmCUWo4E";
const BASE_URL = "https://dniruc.apisperu.com/api/v1";

let clienteVerificado = null;
let prestamosRegistrados = [];
let tipoConsulta = 'dni';
let prestamoActualParaCronograma = null;

// =============== Inicialización ===============
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  fechaInicio.value = today;
  fechaInicio.min = today;

  const guardados = localStorage.getItem("prestamosRegistrados");
  if (guardados) prestamosRegistrados = JSON.parse(guardados);

  actualizarListaPrestamos();
  actualizarCalculos();
});

function guardarPrestamos(){ localStorage.setItem("prestamosRegistrados", JSON.stringify(prestamosRegistrados)); }

// =============== UI Helpers ===============
function cambiarTipoConsulta(tipo){
  tipoConsulta = tipo;
  btnDni.classList.toggle('active', tipo==='dni');
  btnRuc.classList.toggle('active', tipo==='ruc');
  dniSection.classList.toggle('hidden', tipo!=='dni');
  rucSection.classList.toggle('hidden', tipo!=='ruc');
  (tipo==='dni' ? dni : ruc).value = '';
  limpiarResultadoVerificacion();
}
function mostrarNotificacion(m,t='info'){const n=notification;n.textContent=m;n.className=`notification ${t}`;n.classList.remove('hidden');setTimeout(()=>n.classList.add('hidden'),4500)}
function mostrarCargando(s){btnText.classList.toggle('hidden',s);loadingSpinner.classList.toggle('hidden',!s);btnVerificar.disabled=s}

// =============== Consulta DNI/RUC ===============
async function verificarCliente(){
  const valor = (tipoConsulta==='dni'?dni.value.trim():ruc.value.trim());
  if (!valor) return mostrarNotificacion(`Ingrese ${tipoConsulta.toUpperCase()} válido`,'error');
  if (tipoConsulta==='dni' && (valor.length!==8||isNaN(valor))) return mostrarNotificacion('DNI debe tener 8 dígitos','error');
  if (tipoConsulta==='ruc' && (valor.length!==11||isNaN(valor))) return mostrarNotificacion('RUC debe tener 11 dígitos','error');

  mostrarCargando(true); mostrarNotificacion('Consultando con RENIEC/SUNAT...','info');
  try{
    const res = await fetch(`${BASE_URL}/${tipoConsulta}/${valor}?token=${API_TOKEN}`);
    if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
    const data = await res.json(); if (data.error) throw new Error(data.error);

    if (tipoConsulta==='dni'){
      clienteVerificado = { nombre:`${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`, documento:data.dni, tipo:'Persona Natural', direccion:data.direccion||'No disponible', estado:'Activo' };
    } else {
      clienteVerificado = { nombre:data.razonSocial, documento:data.ruc, tipo:data.tipo==='NATURAL'?'Persona Natural':'Persona Jurídica', direccion:data.direccion||'No disponible', estado:data.estado||'Activo' };
    }
    mostrarResultadoVerificacion(); mostrarNotificacion('Cliente verificado correctamente','success');
  }catch(e){ clienteVerificado=null; limpiarResultadoVerificacion(); mostrarNotificacion(`Error al consultar: ${e.message}`,'error'); }
  finally{ mostrarCargando(false); }
}
function mostrarResultadoVerificacion(){
  if (!clienteVerificado) return;
  nombreCliente.textContent=clienteVerificado.nombre;
  documentoCliente.textContent=clienteVerificado.documento;
  tipoCliente.textContent=clienteVerificado.tipo;
  direccionCliente.textContent=clienteVerificado.direccion;
  estadoCliente.textContent=clienteVerificado.estado;
  customerInfo.classList.remove('hidden'); btnRegistrar.disabled=false;
}
function limpiarResultadoVerificacion(){ customerInfo.classList.add('hidden'); btnRegistrar.disabled=true; }

// =============== Utilidades de fecha y cálculo ===============
function sumarMeses(iso,meses){const d=new Date(iso+'T00:00:00');d.setMonth(d.getMonth()+meses);return d.toISOString().split('T')[0]}
function formatearFechaParaTabla(iso){const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`}
function formatearFechaParaCronograma(iso){const f=new Date(iso+'T00:00:00');return f.toLocaleDateString('es-PE',{year:'numeric',month:'long',day:'numeric'})}
function calcularCuotaFija(M,iA,pl){const i=iA/100/12;if(i===0)return M/pl;return M*(i*Math.pow(1+i,pl))/(Math.pow(1+i,pl)-1)}
function diffDias(a,b){const d1=new Date(a+'T00:00:00'),d2=new Date(b+'T00:00:00');return Math.floor((d2-d1)/(1000*60*60*24))}

// --- Feriados Perú (incluye Jueves/Viernes Santo por año) ---
function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
  return new Date(Date.UTC(year, month-1, day));
}
function toISO(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().split('T')[0]}
function addDaysISO(iso,days){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+days);return d.toISOString().split('T')[0]}

function getFeriadosPeru(year){
  const set=new Set();
  const fijos=[[1,1],[5,1],[6,7],[6,29],[7,28],[7,29],[8,30],[10,8],[11,1],[12,8],[12,9],[12,25]];
  fijos.forEach(([m,d])=>set.add(`${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`));
  const pascua=easterSunday(year); const pascuaISO=toISO(pascua);
  set.add(addDaysISO(pascuaISO,-3)); // Jueves Santo
  set.add(addDaysISO(pascuaISO,-2)); // Viernes Santo
  return set;
}

function esDomingo(fechaISO){ const d=new Date(fechaISO+'T00:00:00'); return d.getDay()===0; }
function esFeriadoPeru(fechaISO){
  const y = parseInt(fechaISO.slice(0,4),10);
  const feriados = getFeriadosPeru(y);
  return feriados.has(fechaISO);
}
function siguienteHabilSiDomingoOFeriado(fechaISO){
  let f = fechaISO;
  while (esDomingo(f) || esFeriadoPeru(f)) {
    f = addDaysISO(f, 1);
  }
  return f;
}

// Cálculos en vivo
['monto','interes','plazo','fechaInicio'].forEach(id=>document.getElementById(id).addEventListener(id==='fechaInicio'?'change':'input', actualizarCalculos));
function actualizarCalculos(){
  const monto=parseFloat(montoInput('monto')), interes=parseFloat(montoInput('interes')), plazo=parseInt(montoInput('plazo')), f0=fechaInicio.value;
  if(monto>0 && interes>=0 && plazo>0 && f0){
    const cuota=calcularCuotaFija(monto,interes,plazo), total=cuota*plazo, interTotal=total-monto, f1=sumarMeses(f0,1), fN=sumarMeses(f0,plazo);
    montoPrestado.textContent=`S/ ${monto.toFixed(2)}`; tasaInteres.textContent=`${interes}%`; interesTotal.textContent=`S/ ${interTotal.toFixed(2)}`; montoTotalPagar.textContent=`S/ ${total.toFixed(2)}`;
    fechaDesembolsoMostrada.textContent=formatearFechaParaTabla(f0); fechaPrimeraCuotaMostrada.textContent=formatearFechaParaTabla(f1); fechaUltimaCuotaMostrada.textContent=formatearFechaParaTabla(fN);
    fechaPrimeraCuota.textContent=formatearFechaParaCronograma(f1); montoPrimeraCuota.textContent=`S/ ${cuota.toFixed(2)}`;
    interesCalculado.classList.remove('hidden'); fechaCalculada.classList.remove('hidden'); primeraCuota.classList.remove('hidden');
  } else { interesCalculado.classList.add('hidden'); fechaCalculada.classList.add('hidden'); primeraCuota.classList.add('hidden'); }
}
function montoInput(id){ return document.getElementById(id).value }

// =============== Registrar préstamo ===============
function registrarPrestamo(){
  if(!clienteVerificado) return mostrarNotificacion('Primero verifique al cliente','error');
  const monto=parseFloat(montoInput('monto')), interes=parseFloat(montoInput('interes')), moraDiaria=parseFloat(montoInput('moraDiaria'))||0, plazo=parseInt(montoInput('plazo')), f0=fechaInicio.value;
  if(!(monto>0 && interes>=0 && plazo>0 && f0)) return mostrarNotificacion('Complete los campos correctamente','error');
  const cuota=calcularCuotaFija(monto,interes,plazo), total=cuota*plazo, interTotal=total-monto, f1=sumarMeses(f0,1), fN=sumarMeses(f0,plazo);
  const prestamo={
    id:Date.now(), nroPrestamo:Math.floor(100000+Math.random()*899999).toString(),
    analista:(analista.value || '—').trim(), caja:(caja.value || '—').trim(),
    cliente:clienteVerificado.nombre, documento:clienteVerificado.documento,
    fechaRegistro:new Date().toLocaleDateString('es-PE'), fechaDesembolso:f0, fechaPrimeraCuota:f1, fechaUltimaCuota:fN,
    monto, interes, interesTotal:interTotal, plazo, cuotaMensual:cuota, montoTotal:total,
    moraDiaria, cuotasPagadas:0, moraAcumulada:0, pagos:[]
  };
  prestamosRegistrados.push(prestamo); guardarPrestamos(); actualizarListaPrestamos(); limpiarFormularioPrestamo(); mostrarNotificacion('Préstamo registrado exitosamente','success');
}
function limpiarFormularioPrestamo(){['monto','analista','caja'].forEach(id=>document.getElementById(id).value=''); interes.value='5'; moraDiaria.value='0.05'; plazo.value='12'; fechaInicio.value=new Date().toISOString().split('T')[0]; interesCalculado.classList.add('hidden'); fechaCalculada.classList.add('hidden'); primeraCuota.classList.add('hidden')}

// =============== Listado (eliminar / abrir cronograma) ===============
function actualizarListaPrestamos(){
  totalPrestamos.textContent=prestamosRegistrados.length;
  if(prestamosRegistrados.length===0){loansList.innerHTML='<p id="noLoans">No hay préstamos registrados aún.</p>';return;}
  const ordenados=[...prestamosRegistrados].sort((a,b)=>new Date(b.fechaDesembolso)-new Date(a.fechaDesembolso));
  loansList.innerHTML=ordenados.map(p=>`
    <div class="loan-item">
      <div class="loan-actions">
        <button class="generate-btn" onclick="abrirModalCronograma(${p.id})">Cronograma</button>
        <button class="delete-btn" onclick="eliminarPrestamo(${p.id})">Eliminar</button>
      </div>
      <h4>${p.cliente}</h4>
      <div class="loan-details">
        <div><strong>Registro:</strong> ${p.fechaRegistro}</div>
        <div><strong>Doc:</strong> ${p.documento}</div>
        <div><strong>Desembolso:</strong> ${formatearFechaParaTabla(p.fechaDesembolso)}</div>
        <div><strong>Primera:</strong> ${formatearFechaParaTabla(p.fechaPrimeraCuota)}</div>
        <div><strong>Última:</strong> ${formatearFechaParaTabla(p.fechaUltimaCuota)}</div>
        <div><strong>Monto:</strong> S/ ${p.monto.toFixed(2)}</div>
        <div><strong>Interés:</strong> ${p.interes}%</div>
        <div><strong>Interés Total:</strong> S/ ${p.interesTotal.toFixed(2)}</div>
        <div><strong>Cuota:</strong> S/ ${p.cuotaMensual.toFixed(2)}</div>
        <div><strong>Plazo:</strong> ${p.plazo} meses</div>
        <div><strong>Total:</strong> S/ ${p.montoTotal.toFixed(2)}</div>
        <div><strong>Pagadas:</strong> ${p.cuotasPagadas}</div>
      </div>
    </div>`).join('');
}
function eliminarPrestamo(id){
  const i=prestamosRegistrados.findIndex(p=>p.id===id); if(i===-1) return;
  if(!confirm('¿Eliminar este préstamo?')) return;
  const wasOpen = prestamoActualParaCronograma && prestamoActualParaCronograma.id===id;
  prestamosRegistrados.splice(i,1); guardarPrestamos(); actualizarListaPrestamos();
  if (wasOpen) cerrarModalCronograma();
  mostrarNotificacion('Préstamo eliminado','success');
}

// =============== Cronograma / Modal ===============
function generarCronogramaEnModal(p){
  cronogramaClienteModal.textContent=p.cliente;
  cronogramaDocumentoModal.textContent=`Documento: ${p.documento}`;
  cronogramaDetallesModal.textContent=`Monto: S/ ${p.monto.toFixed(2)} | Tasa: ${p.interes}% | Plazo: ${p.plazo} meses | Mora diaria: ${p.moraDiaria}%`;

  const tbody=cronogramaBodyModal; tbody.innerHTML='';
  const cuota=p.cuotaMensual; let saldo=p.monto, totA=0, totI=0;
  for(let i=1;i<=p.plazo;i++){
    const vtoISO=sumarMeses(p.fechaDesembolso,i), fecha=formatearFechaParaTabla(vtoISO), iM=p.interes/100/12;
    const interes=saldo*iM; let amort=cuota-interes; let cuotaReal=cuota; if(i===p.plazo){amort=saldo;cuotaReal=amort+interes}
    saldo-=amort; totA+=amort; totI+=interes;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i}</td><td>${fecha}</td><td>S/ ${amort.toFixed(2)}</td><td>S/ ${interes.toFixed(2)}</td><td>S/ ${cuotaReal.toFixed(2)}</td><td>S/ ${saldo.toFixed(2)}</td>`;
    tr.style.opacity=(p.cuotasPagadas||0)>=i ? '.55' : '1';
    tbody.appendChild(tr);
  }
  totalAmortizacionModal.textContent=`S/ ${totA.toFixed(2)}`;
  totalInteresModal.textContent=`S/ ${totI.toFixed(2)}`;
  totalCuotaModal.textContent=`S/ ${(totA+totI).toFixed(2)}`;
  saldoFinalModal.textContent=`S/ ${saldo.toFixed(2)}`;

  // Próxima cuota (ajustada por domingo/feriado)
  const prox = obtenerProximaCuotaNoPagada(p);
  let texto = 'Todas las cuotas están pagadas.';
  if (prox) {
    const vtoAjust = siguienteHabilSiDomingoOFeriado(prox.fechaVencISO);
    const etiqueta = (vtoAjust!==prox.fechaVencISO) ? ' (ajustada por día no laborable)' : '';
    texto = `Próxima cuota: N° ${prox.nCuota} • Vence: ${formatearFechaParaTabla(vtoAjust)}${etiqueta} • Monto: S/ ${prox.montoCuota.toFixed(2)}`;
  }
  proximaInfoTexto.textContent = texto;

  fechaPagoInput.value = new Date().toISOString().split('T')[0];
  moraEditableInput.value = (p.moraDiaria ?? 0).toString();
  renderHistorialPagos(p);

  prestamoActualParaCronograma=p;
}
function abrirModalCronograma(id){const p=prestamosRegistrados.find(x=>x.id===id);if(!p)return;generarCronogramaEnModal(p);cronogramaModal.style.display='block'}
function cerrarModalCronograma(){cronogramaModal.style.display='none';prestamoActualParaCronograma=null}
window.onclick=function(e){if(e.target===cronogramaModal) cerrarModalCronograma()}

// =============== Pagos + Mora + Historial ===============
function obtenerProximaCuotaNoPagada(p){const n=(p.cuotasPagadas||0)+1; if(n>p.plazo) return null; return {nCuota:n,fechaVencISO:sumarMeses(p.fechaDesembolso,n),montoCuota:p.cuotaMensual};}

function registrarPagoCuotaSiguiente(){
  if(!prestamoActualParaCronograma) return mostrarNotificacion("No hay cronograma abierto.","error");
  const p=prestamoActualParaCronograma;
  const prox=obtenerProximaCuotaNoPagada(p); if(!prox) return mostrarNotificacion("Todas las cuotas ya están pagadas.","info");

  const fechaPago = fechaPagoInput.value || new Date().toISOString().split('T')[0];

  // Ajuste por día no laborable
  const vtoAjust = siguienteHabilSiDomingoOFeriado(prox.fechaVencISO);

  const diasAtraso = Math.max(0, diffDias(vtoAjust, fechaPago));
  let mora = 0;
  if (diasAtraso >= 1 && p.moraDiaria > 0){
    mora = +(prox.montoCuota * (p.moraDiaria/100) * diasAtraso).toFixed(2);
  }

  p.cuotasPagadas = (p.cuotasPagadas || 0) + 1;
  p.moraAcumulada = +((p.moraAcumulada || 0) + mora).toFixed(2);
  p.pagos.push({ nCuota: prox.nCuota, fechaPagoISO: fechaPago, moraCobrada: mora, montoCuota: prox.montoCuota });

  const idx = prestamosRegistrados.findIndex(x=>x.id===p.id); if(idx!==-1) prestamosRegistrados[idx]=p;
  guardarPrestamos();
  generarCronogramaEnModal(p);
  actualizarListaPrestamos();

  mostrarNotificacion(mora>0
    ? `Cuota ${prox.nCuota} pagada con ${diasAtraso} día(s) de atraso. Mora: S/ ${mora.toFixed(2)}`
    : `Cuota ${prox.nCuota} pagada sin mora.`, 'success');
}

function actualizarMoraDiariaPrestamo(){
  if(!prestamoActualParaCronograma) return mostrarNotificacion("No hay cronograma abierto.","error");
  const val = parseFloat(moraEditableInput.value);
  if (isNaN(val) || val < 0) return mostrarNotificacion("Ingresa una mora diaria válida (>= 0).","error");
  prestamoActualParaCronograma.moraDiaria = val;
  const idx = prestamosRegistrados.findIndex(p=>p.id===prestamoActualParaCronograma.id);
  if (idx !== -1) prestamosRegistrados[idx].moraDiaria = val;
  guardarPrestamos();
  generarCronogramaEnModal(prestamoActualParaCronograma);
  actualizarListaPrestamos();
  mostrarNotificacion("Mora diaria actualizada.","success");
}

function anularUltimoPago(){
  if(!prestamoActualParaCronograma) return mostrarNotificacion("No hay cronograma abierto.","error");
  const p=prestamoActualParaCronograma;
  if(!p.pagos || p.pagos.length===0) return mostrarNotificacion("No hay pagos para anular.","info");
  const ultimo=p.pagos[p.pagos.length-1];
  const ok=confirm(`¿Anular el último pago? (Cuota ${ultimo.nCuota}, ${ultimo.fechaPagoISO}, Mora S/ ${(+ultimo.moraCobrada).toFixed(2)})`);
  if(!ok) return;

  p.pagos.pop();
  p.cuotasPagadas = Math.max(0,(p.cuotasPagadas||0)-1);
  p.moraAcumulada = +((p.moraAcumulada||0) - (+ultimo.moraCobrada||0)).toFixed(2);

  const idx=prestamosRegistrados.findIndex(x=>x.id===p.id); if(idx!==-1) prestamosRegistrados[idx]=p;
  guardarPrestamos();
  generarCronogramaEnModal(p);
  actualizarListaPrestamos();
  mostrarNotificacion(`Pago de la cuota ${ultimo.nCuota} anulado.`,'success');
}

function renderHistorialPagos(p){
  const body=historialPagosBody;
  if(!p.pagos || p.pagos.length===0){ body.innerHTML='<tr><td colspan="5">Sin pagos aún.</td></tr>'; return; }
  const last=p.pagos.length-1;
  body.innerHTML = p.pagos.map((pg,i)=>`
    <tr>
      <td>${pg.nCuota}</td>
      <td>${formatearFechaParaTabla(pg.fechaPagoISO)}</td>
      <td>S/ ${(+pg.moraCobrada).toFixed(2)}</td>
      <td>S/ ${(+pg.montoCuota).toFixed(2)}</td>
      <td>${ i===last ? '<button class="mini-btn mini-btn-danger" onclick="anularUltimoPago()">Anular</button>' : '<span style="color:#718096;">—</span>' }</td>
    </tr>
  `).join('');
}

// =============== PDF: Imprimir (diálogo nativo) ===============
function imprimirCronogramaActual(){
  if(!prestamoActualParaCronograma) return;
  const html = generarHTMLCronograma(prestamoActualParaCronograma);
  const w = window.open('', '_blank'); w.document.write(html); w.document.close();
  setTimeout(()=>{ w.focus(); w.print(); }, 250);
}

// =============== PDF real: Compartir / Descargar (.pdf) ===============
async function generarPDFBlobDesdeHTML(htmlString){
  const iframe=document.createElement('iframe');
  iframe.style.position='fixed'; iframe.style.left='-10000px'; iframe.style.top='-10000px';
  iframe.style.width='1024px'; iframe.style.height='0';
  document.body.appendChild(iframe);
  const doc=iframe.contentDocument||iframe.contentWindow.document;
  doc.open(); doc.write(htmlString); doc.close();
  await new Promise(r=>setTimeout(r,350));
  const target=doc.body;
  const canvas=await html2canvas(target,{scale:2,useCORS:true,backgroundColor:'#ffffff'});
  const { jsPDF }=window.jspdf; const pdf=new jsPDF('p','mm','a4');
  const imgData=canvas.toDataURL('image/png'); const pdfW=pdf.internal.pageSize.getWidth(); const pdfH=pdf.internal.pageSize.getHeight();
  const imgWpx=canvas.width, imgHpx=canvas.height, ratio=imgWpx/imgHpx;
  const imgWmm=pdfW, imgHmm=imgWmm/ratio; let posY=0, heightLeft=imgHmm;
  pdf.addImage(imgData,'PNG',0,posY,imgWmm,imgHmm); heightLeft-=pdfH;
  while(heightLeft>0){ pdf.addPage(); posY=-(imgHmm-heightLeft); pdf.addImage(imgData,'PNG',0,posY,imgWmm,imgHmm); heightLeft-=pdfH; }
  document.body.removeChild(iframe);
  return pdf.output('blob');
}

async function compartirCronogramaPDF(){
  if(!prestamoActualParaCronograma) return mostrarNotificacion("Abre un cronograma antes de compartir.","error");
  const p=prestamoActualParaCronograma;
  try{
    const html=generarHTMLCronograma(p);
    const blobPDF=await generarPDFBlobDesdeHTML(html);
    const nombre=`cronograma_${p.cliente.replace(/\s+/g,'_')}_${p.documento}.pdf`;
    const file=new File([blobPDF], nombre, {type:'application/pdf'});

    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({title:'Cronograma de Pagos', text:`Cronograma de ${p.cliente} (${p.documento})`, files:[file]});
      mostrarNotificacion("PDF compartido correctamente.","success");
      return;
    }
    const url=URL.createObjectURL(blobPDF);
    const a=document.createElement('a'); a.href=url; a.download=nombre; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    mostrarNotificacion("PDF descargado. Puedes enviarlo por tu app favorita.","info");
  }catch(e){ console.error(e); mostrarNotificacion("No se pudo generar el PDF para compartir.","error"); }
}

// =============== Número a letras (Soles) ===============
function numeroALetrasSoles(n){
  const u=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte'];
  const d=['','', 'veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const c=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  function s(n){if(n<=20)return u[n];if(n<100){const D=Math.floor(n/10),U=n%10;if(n<30)return U?`veinti${u[U]}`:'veinte';return U?`${d[D]} y ${u[U]}`:d[D]}if(n<1000){const C=Math.floor(n/100),R=n%100;if(n===100)return'cien';return R?`${c[C]} ${s(R)}`:c[C]}if(n<1e6){const M=Math.floor(n/1000),R=n%1000;const mil=(M===1)?'mil':`${s(M)} mil`;return R?`${mil} ${s(R)}`:mil}const MM=Math.floor(n/1e6),R=n%1e6;const mill=(MM===1)?'un millón':`${s(MM)} millones`;return R?`${mill} ${s(R)}`:mill}
  const S=Math.floor(n), Cts=Math.round((n-S)*100); const txt=`${s(S)} ${S===1?'sol':'soles'} con ${Cts.toString().padStart(2,'0')}/100`; return txt.charAt(0).toUpperCase()+txt.slice(1);
}

// =============== HTML del PDF (con recibo e info) ===============
function generarHTMLCronograma(p){
  // Próximo pago (ajustado por día no laborable)
  const prox = obtenerProximaCuotaNoPagada(p);
  let proximoTexto='—';
  if(prox){
    const vtoAjust=siguienteHabilSiDomingoOFeriado(prox.fechaVencISO);
    proximoTexto = formatearFechaParaTabla(vtoAjust) + (vtoAjust!==prox.fechaVencISO ? ' (ajustada por día no laborable)' : '');
  }

  const capital=p.monto, interesComp=p.interesTotal, interesMora=+(p.moraAcumulada||0), envioFisico=0.00;
  const totalCobro=capital+interesComp+interesMora+envioFisico, itf=+(totalCobro*0.00005).toFixed(2), totalPagado=+(totalCobro+itf).toFixed(2);
  const montoEnLetras=numeroALetrasSoles(totalPagado);

  const ahora=new Date(); const fechaHora=ahora.toLocaleDateString('es-PE')+' '+ahora.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cronograma de Pagos</title>
  <style>
    body{font-family:Arial,sans-serif;padding:20px}
    .header{text-align:center;margin-bottom:14px}
    .subtle{color:#4a5568;font-size:12px;text-align:center;margin-top:-6px}
    .info{text-align:center;margin:16px 0;padding:12px;background:#f0f0f0;border-radius:8px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #000;padding:8px;text-align:center;font-size:13px}
    th{background:#667eea;color:#fff;font-weight:bold;text-transform:uppercase}
    .total{font-weight:bold;background:#e8f5e8}
    .footer{text-align:center;margin-top:24px;font-size:12px}
    .receipt{font-family:"Courier New",monospace;background:#fff;border:1px dashed #a0aec0;border-radius:8px;padding:14px;margin-top:10px}
    .r-row{display:flex;justify-content:space-between;margin:4px 0}
    .r-title{text-align:center;font-weight:700;margin-bottom:8px}
    .r-muted{color:#4a5568;font-size:12px;text-align:center;margin-top:8px;white-space:pre-line}
    hr{border:0;border-top:1px dashed #cbd5e0;margin:10px 0}
    @page{size:A4;margin:16mm}
  </style></head><body>
    <div class="header"><h2>CRONOGRAMA DE PAGOS</h2></div>
    <div class="subtle">Generado: ${fechaHora}</div>

    <div class="receipt">
      <div class="r-title">COMPROBANTE / RESUMEN</div>
      <div class="r-row"><span>Cliente:</span><span>${p.cliente}</span></div>
      <div class="r-row"><span>Documento:</span><span>${p.documento}</span></div>
      <div class="r-row"><span>Anal. Crédito:</span><span>${p.analista||'—'}</span></div>
      <div class="r-row"><span>Nro. Préstamo:</span><span>${p.nroPrestamo||p.id}</span></div>
      <div class="r-row"><span>Caja:</span><span>${p.caja||'—'}</span></div>
      <hr>
      <div class="r-row"><span>Capital</span><span>S/ ${capital.toFixed(2)}</span></div>
      <div class="r-row"><span>Interés Compensatorio</span><span>S/ ${interesComp.toFixed(2)}</span></div>
      <div class="r-row"><span>Int. Mor. Atr.</span><span>S/ ${interesMora.toFixed(2)}</span></div>
      <div class="r-row"><span>Env. Físico EECC</span><span>S/ ${envioFisico.toFixed(2)}</span></div>
      <hr>
      <div class="r-row"><strong>Total Cobro</strong><strong>S/ ${totalCobro.toFixed(2)}</strong></div>
      <div class="r-row"><span>I.T.F. 0.005%</span><span>S/ ${itf.toFixed(2)}</span></div>
      <div class="r-row"><strong>Total Pagado</strong><strong>S/ ${totalPagado.toFixed(2)}</strong></div>
      <hr>
      <div class="r-row"><span>Son:</span><span>${montoEnLetras}</span></div>
      <div class="r-row"><span>Cuotas Pagadas:</span><span>${p.cuotasPagadas||0}</span></div>
      <div class="r-row"><span>Próximo pago:</span><span>${proximoTexto}</span></div>
      <div class="r-muted">Los montos pendientes de pago no incluyen intereses moratorios futuros.
Evite recargos pagando a tiempo.
Este documento es válido para crédito fiscal.</div>
    </div>

    <div class="info">
      <h3>${p.cliente}</h3>
      <p>Monto: S/ ${p.monto.toFixed(2)}  |  Tasa: ${p.interes}%  |  Plazo: ${p.plazo} meses  |  Mora diaria: ${p.moraDiaria}%</p>
      <p>Desembolso: ${formatearFechaParaTabla(p.fechaDesembolso)}  •  1ra Cuota: ${formatearFechaParaTabla(p.fechaPrimeraCuota)}  •  Última: ${formatearFechaParaTabla(p.fechaUltimaCuota)}</p>
    </div>

    <table>
      <thead><tr><th>MES</th><th>VENCIMIENTO</th><th>AMORTIZACIÓN</th><th>INTERÉS</th><th>CUOTA</th><th>SALDO</th></tr></thead>
      <tbody>${
        (()=>{let rows='',saldo=p.monto,iM=p.interes/100/12;
          for(let i=1;i<=p.plazo;i++){
            const v=sumarMeses(p.fechaDesembolso,i), f=formatearFechaParaTabla(v), inter=saldo*iM;
            let amort=p.cuotaMensual-inter, cuota=p.cuotaMensual; if(i===p.plazo){amort=saldo;cuota=amort+inter}
            saldo-=amort; rows+=`<tr><td>${i}</td><td>${f}</td><td>S/ ${amort.toFixed(2)}</td><td>S/ ${inter.toFixed(2)}</td><td>S/ ${cuota.toFixed(2)}</td><td>S/ ${saldo.toFixed(2)}</td></tr>`;
          } return rows;
        })()
      }</tbody>
      <tfoot><tr class="total"><td colspan="2" style="text-align:right;padding-right:10px;">TOTAL:</td><td>S/ ${p.monto.toFixed(2)}</td><td>S/ ${p.interesTotal.toFixed(2)}</td><td>S/ ${p.montoTotal.toFixed(2)}</td><td>S/ 0.00</td></tr></tfoot>
    </table>

    <div class="footer"><p>Documento generado automáticamente por el sistema de préstamos</p></div>
    <script>setTimeout(()=>{if(window.print)window.print()},400)<\/script>
  </body></html>`;
}
