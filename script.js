// script.js
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultado = document.getElementById("resultado");
const btnIniciar = document.getElementById("iniciar");
const btnModelo1 = document.getElementById("modelo1");
const btnModelo2 = document.getElementById("modelo2");
const btnModelo3 = document.getElementById("modelo3");
const btnModelo4 = document.getElementById("modelo4");

const labelAltura = document.getElementById("label-altura");
const labelDistancia = document.getElementById("label-distancia");
const labelVelocidad = document.getElementById("label-velocidad");

let tiempo = 0;
let bola, rozamientoZona, animacionActiva = null, offset = 0, modeloActual = 1;

canvas.width = Math.max(canvas.width, 700);
canvas.height = Math.max(canvas.height, 300);

// Elementos de energía
const epDisplay = document.getElementById("ep")
const ekDisplay = document.getElementById("ek")
const etDisplay = document.getElementById("et")
const eeDisplay = document.getElementById("ee")
const elostDisplay = document.getElementById("elost")

// resorte
let resorteCompresion = 0;     
let resorteMaxCompresion = 50;
let k = 0.5;  


function pixelsAMetros(px) { return px / 100 }

function calcularEnergiaP(x, y) {
  if (modeloActual !== 3) return 0

  const alturaReferencia = 250
  const alturaActual = alturaReferencia - y
  const h = pixelsAMetros(alturaActual)
  const g = 9.81

  return bola.masa * g * Math.max(0, h)
}

function calcularEnergiaK(velocidad) {
  return 0.5 * bola.masa * velocidad * velocidad
}

function actualizarEnergia() {
  let ep = 0, ek = 0, ee = 0;

  if (modeloActual === 3 || modeloActual === 4) {
    ep = calcularEnergiaP(bola.x, bola.y);
    ek = Math.max(0, bola.energiaInicial - ep - bola.energiaElastica); // Conservación de energía
    ee = bola.energiaElastica || 0; // Energía elástica del resorte
  } else {
    ek = calcularEnergiaK(bola.velocidad);
  }

  const et = ep + ek + ee;

  const elost = modeloActual === 3 || modeloActual === 4 ? 0 : Math.max(0, bola.energiaInicial - et);

  epDisplay.textContent = ep.toFixed(2) + " J";
  ekDisplay.textContent = ek.toFixed(2) + " J";
  etDisplay.textContent = et.toFixed(2) + " J";
  eeDisplay.textContent = ee.toFixed(2) + " J";
  elostDisplay.textContent = elost.toFixed(2) + " J";
}


// ENERGIA RESODRTE

function calcularEnergiaPResorte(compresionPx) {
  if (compresionPx <= 0) return 0;
    
  // x debe estar en metros
  const compresionM = pixelsAMetros(compresionPx);
    
  // Ep = 0.5 * k * x^2
  return 0.5 * k * compresionM * compresionM;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ----- curva Bézier aproximada -----
function curvaRampaY(x) {
  const rampaLargo = 300;
  const yBase = 200;
  const altura = 140;

  if (x <= 0) return yBase - altura;
  if (x >= rampaLargo) return yBase + 20;

  const t = x / rampaLargo;
  return (yBase - altura) + (1 - (1 - t)*(1 - t)) * (altura + 20);
}

function dibujarRampaCurva(offsetLocal = 0) {
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let px = 0; px <= 600; px += 2) {
    const y = curvaRampaY(px);
    if (px === 0) ctx.moveTo(px - offsetLocal, y);
    else ctx.lineTo(px - offsetLocal, y);
  }
  ctx.stroke();
}

function dibujarRampaCurvaResorte(offsetLocal = 0) {
  // --- DIBUJAR CURVA ---
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 3;
  ctx.beginPath();

  let ultimoX = 0;
  let ultimoY = 0;

  for (let px = 0; px <= 600; px += 2) {
    let y = curvaRampaY(px);

    // Si tu función devolvió NaN, ponemos un valor de fallback
    if (isNaN(y)) y = 300;

    const xReal = px - offsetLocal;

    if (px === 0) ctx.moveTo(xReal, y);
    else ctx.lineTo(xReal, y);

    // guardamos el final real de la curva
    if (px === 600) {
      ultimoX = xReal;
      ultimoY = y;
    }
  }

  ctx.stroke();

  // --- DIBUJAR RESORTE ---
  let xFinal = 520 - offsetLocal;
  let yFinal = curvaRampaY(600) -15;

  // límite del canvas
  if (xFinal > canvas.width) xFinal = canvas.width - 1;
  if (xFinal < 0) xFinal = 0;

  const largoResorte = 80;
  const zigZags = 10;
  const amplitud = 10;
  const paso = largoResorte / zigZags;

  ctx.beginPath();
  ctx.strokeStyle = "red";
  ctx.lineWidth = 3;

  ctx.moveTo(xFinal, yFinal);

  for (let i = 1; i <= zigZags; i++) {
    const x = xFinal + paso * i;
    const y = yFinal + (i % 2 === 0 ? -amplitud : amplitud);
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}


// ---------------- Inicializar ----------------
function inicializar() {

  const masa = parseFloat(document.getElementById("masa").value) || 1;
  const velocidadIn = parseFloat(document.getElementById("velocidad").value) || 0;
  const distancia = parseFloat(document.getElementById("distancia").value) || 200;
  const radio = 10;

  if (modeloActual === 1 || modeloActual === 2) {
    bola = {
      x: 11,
      y: 200,
      radio,
      masa,
      velocidad: velocidadIn,
      distanciaRecorrida: 0,
      energiaInicial: 0.5 * masa * velocidadIn * velocidadIn,
      energiaFinal: 0,
      longitudTotal: distancia * 30,
      trail: []
    };
  }

  // ----------- MODELO 3: curva -------------
  else if (modeloActual === 3) {
    const altura = parseFloat(document.getElementById("altura").value) || 1;

    bola = {
      x: 0,
      y: curvaRampaY(0) - radio,
      radio,
      masa,
      velocidad: 0, // ignora velocidad inicial
      distanciaRecorrida: 0,
      // energia inicial = mgh
      energiaInicial: masa * 9.81 * altura,
      energiaFinal: 0,

      longitudTotal: 600,
      trail: []
    };
  }

  else if (modeloActual === 4) {
    const altura = parseFloat(document.getElementById("altura").value) || 1;
  
    bola = {
      x: 0,
      y: curvaRampaY(0) - radio,
      radio,
      masa,
      velocidad: 0, // ignora velocidad inicial
      distanciaRecorrida: 0,
      // energía inicial = mgh (sin dividir entre 100)
      energiaInicial: masa * 9.81 * altura,
      energiaElastica: 0, // El resorte aún no está comprimido
      energiaFinal: 0,
  
      longitudTotal: 600,
      trail: []
    };
  }

  rozamientoZona = { inicio: 400, fin: 600 };

  offset = 0;
  resultado.textContent = "Energía final:";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarEscena();
}


// ----------------- Dibujar -----------------
function dibujarEscena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  offset = bola.x - canvas.width * 0.25;
  if (offset < 0) offset = 0;
  if (offset > bola.longitudTotal - canvas.width) 
      offset = bola.longitudTotal - canvas.width;

  if (modeloActual === 1) {
    ctx.fillStyle = "rgb(151,225,248)";
    ctx.fillRect(-offset, 210, bola.longitudTotal + offset + 100, 3);
  }

  else if (modeloActual === 2) {
    ctx.fillStyle = "rgb(200,180,150)";
    ctx.fillRect(-offset, 210, bola.longitudTotal + offset + 100, 3);
    ctx.fillStyle = "red";
    for (let x = rozamientoZona.inicio; x < rozamientoZona.fin; x += 12) {
      ctx.beginPath();
      ctx.arc(x - offset, 212, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  else if (modeloActual === 3) {
    dibujarRampaCurva(offset);

    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const rampaLargo = 300;
    const startX = rampaLargo - offset;
    const startY = curvaRampaY(rampaLargo);

    ctx.moveTo(startX, startY);
    ctx.lineTo(bola.longitudTotal - offset, startY);
    ctx.stroke();
  }

  else if (modeloActual === 4) {
    dibujarRampaCurvaResorte(offset);

    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const rampaLargo = 300;
    const startX = rampaLargo - offset;
    const startY = curvaRampaY(rampaLargo);

    ctx.moveTo(startX, startY);
    ctx.lineTo(bola.longitudTotal - offset, startY);

    ctx.fillStyle = "red";
    for (let x = rozamientoZona.inicio - 100; x < rozamientoZona.fin- 100; x += 12) {
      ctx.beginPath();
      ctx.arc(x - offset, startY + 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.stroke();
  }

  bola.trail.forEach((p, i) => {
    const op = i / bola.trail.length;
    const salto = Math.sin(tiempo + i * 0.5) * 2;

    ctx.fillStyle = `rgba(26, 124, 83, ${op * 0.6})`;
    ctx.beginPath();
    ctx.arc(p.x - offset, p.y + salto, bola.radio * 0.7, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.beginPath();
  ctx.fillStyle = "rgb(26,124,83)";
  ctx.arc(bola.x - offset, bola.y, bola.radio, 0, Math.PI * 2);
  ctx.fill();
}

// ----------------- Movimiento -----------------
function moverBola() {
  
  const dt = 0.1;
  const rozamiento = 0.1;

  if (modeloActual === 4) {
    const dx = 1;
    const dy = curvaRampaY(bola.x + dx) - curvaRampaY(Math.max(0, bola.x - dx));
    const pendiente = dy / (2 * dx);
  
    const ang = Math.atan(pendiente || 0);
    const g = 9.81;
  
    const a = g * Math.sin(ang);
  
    const inicioResorte = 520; // Posición donde comienza el resorte
    const constanteK = 3; // Constante del resorte
  
    bola.velocidad += a * dt;
    bola.velocidad = clamp(bola.velocidad, -200, 200);
  
    bola.x += bola.velocidad * dt * 10;
    bola.y = curvaRampaY(bola.x) - bola.radio;
  
    if (bola.x + bola.radio >= inicioResorte) {
      // Compresión del resorte
      const compresion = (bola.x + bola.radio) - inicioResorte;
  
      if (compresion > 0) {
        // Energía elástica almacenada en el resorte
        bola.energiaElastica = 0.5 * constanteK * compresion * compresion;
  
        // Fuerza del resorte hacia atrás
        const F_resorte = -constanteK * compresion;
  
        // Aceleración por la fuerza del resorte
        const a_resorte = F_resorte / bola.masa;
  
        bola.velocidad += a_resorte * dt * 10;

        bola.x += bola.velocidad * dt * 10;
  
        // Asegurar que la bola siga la curva
        bola.y = curvaRampaY(bola.x) - bola.radio;
      
        const enZonaRoz = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;
        if (enZonaRoz && bola.y >= curvaRampaY(300) - bola.radio - 1) {  
            bola.velocidad -= rozamiento;
            if (bola.velocidad < -0.5) bola.velocidad = -0.5; // deja rebote leve pero no infinito
        }
      }
    }
  }

  if (modeloActual === 3) {

    const dx = 1;
    const dy = curvaRampaY(bola.x + dx) - curvaRampaY(Math.max(0, bola.x - dx));
    const pendiente = dy / (2 * dx);

    const ang = Math.atan(pendiente || 0);
    const g = 9.81;

    const a = g * Math.sin(ang);

    bola.velocidad += a * dt;
    bola.velocidad = clamp(bola.velocidad, -200, 200);

    bola.x += bola.velocidad * dt * 10;
    bola.y = curvaRampaY(bola.x) - bola.radio;
  }

  if (modeloActual === 2) {
    const enZonaRozamiento = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;
    if (enZonaRozamiento) {
      bola.velocidad -= rozamiento;
      if (bola.velocidad < 0) bola.velocidad = 0;
    }
    bola.x += bola.velocidad * dt * 10;
    bola.distanciaRecorrida += bola.velocidad * dt;
  }

  if (modeloActual === 1) {
    bola.x += bola.velocidad * dt * 10;
    bola.distanciaRecorrida += bola.velocidad * dt;
  }

  dibujarEscena();
  actualizarEnergia()

  bola.trail.push({ x: bola.x, y: bola.y });
  if (bola.trail.length > 15) bola.trail.shift();

  tiempo += 0.15;

  if (bola.x >= bola.longitudTotal) { // se sacó velocidad no puede ser negativa.

    if (modeloActual === 3) {

      
      const vFinal = Math.sqrt((2 * bola.energiaInicial) / bola.masa);
      // Forzar Ep final = 0
      epDisplay.textContent = "0.00 J";
      ekDisplay.textContent = bola.energiaInicial.toFixed(2) + " J";
      etDisplay.textContent = bola.energiaInicial.toFixed(2) + " J";
      elostDisplay.textContent = "0.00 J";


      resultado.textContent =
        `Energía final: ${bola.energiaInicial.toFixed(2)} J ——— Velocidad final: ${vFinal.toFixed(2)} m/s`;

    } else {

      bola.energiaFinal = 0.5 * bola.masa * bola.velocidad * bola.velocidad;
      resultado.textContent = 
        `Energía final: ${bola.energiaFinal.toFixed(2)} J`;
    }

    cancelAnimationFrame(animacionActiva);
    animacionActiva = null;
    return;
  }

  animacionActiva = requestAnimationFrame(moverBola);
}

// ----------------- EVENTOS -----------------
btnIniciar.addEventListener("click", () => {
  inicializar();
  if (animacionActiva) cancelAnimationFrame(animacionActiva);
  animacionActiva = requestAnimationFrame(moverBola);
});

btnModelo1.addEventListener("click", () => {
  modeloActual = 1;
  btnModelo1.style.backgroundColor = "rgb(100,180,255)";
  labelAltura.style.display = "none";
  labelDistancia.style.display = "block";
  btnModelo2.style.backgroundColor = ""; 
  btnModelo3.style.backgroundColor = "";
  btnModelo4.style.backgroundColor = "";
});

btnModelo2.addEventListener("click", () => {
  modeloActual = 2;
  btnModelo2.style.backgroundColor = "rgb(100,180,255)";
  labelAltura.style.display = "none";
  labelDistancia.style.display = "block";
  btnModelo1.style.backgroundColor = ""; 
  btnModelo3.style.backgroundColor = "";
  btnModelo4.style.backgroundColor = "";
});

btnModelo3.addEventListener("click", () => {
  modeloActual = 3;
  btnModelo3.style.backgroundColor = "rgb(100,180,255)";
  labelAltura.style.display = "block";
  labelVelocidad.style.display = "none";
  labelDistancia.style.display = "none";
  btnModelo1.style.backgroundColor = ""; 
  btnModelo2.style.backgroundColor = "";
  btnModelo4.style.backgroundColor = "";
});

btnModelo4.addEventListener("click", () => {
  modeloActual = 4;
  btnModelo4.style.backgroundColor = "rgb(100,180,255)";
  labelAltura.style.display = "block";
  labelVelocidad.style.display = "none";
  labelDistancia.style.display = "none";
  btnModelo1.style.backgroundColor = ""; 
  btnModelo2.style.backgroundColor = "";
  btnModelo3.style.backgroundColor = "";
});

btnModelo1.classList.add("activo")
inicializar();
